'use strict';

const { randomUUID } = require('node:crypto');
const { Op } = require('sequelize');
const { getConnection, getReadConnection } = require('../config/database');
const { initModels } = require('../models');
const HttpError = require('../utils/httpError');

const MESSAGE_FIELDS = [
  'id', 'conversacion_id', 'pregunta', 'respuesta', 'agente', 'intencion', 'tema',
  'agentes_utilizados', 'citas_documentales', 'fragmentos_utilizados', 'documentos_citados',
  'resolucion', 'escalamiento_realizado', 'escalamiento_sugerido', 'latencia_ms', 'creado_en'
];

function asPlain(record) {
  return typeof record?.get === 'function' ? record.get({ plain: true }) : record;
}

function publicMessage(record) {
  const row = asPlain(record);
  return {
    id: row.id,
    conversationId: row.conversacion_id,
    question: row.pregunta,
    answer: row.respuesta,
    intent: row.intencion,
    topic: row.tema,
    agent: row.agente || 'ORQUESTADOR',
    agentsUsed: row.agentes_utilizados || (row.agente && row.agente !== 'ORQUESTADOR' ? [row.agente] : []),
    fragmentsUsed: row.fragmentos_utilizados || [],
    citations: row.citas_documentales || [],
    documentsCited: row.documentos_citados || [],
    resolution: row.resolucion,
    resolved: row.resolucion === 'RESPONDIDA',
    clarificationNeeded: row.agente === 'ORQUESTADOR' && row.intencion === null,
    escalationSuggested: Boolean(row.escalamiento_sugerido),
    escalated: Boolean(row.escalamiento_realizado),
    latencyMs: row.latencia_ms ?? 0,
    createdAt: row.creado_en
  };
}

function cachedResponse(record) {
  const message = publicMessage(record);
  return {
    messageId: message.id,
    conversationId: message.conversationId,
    answer: message.answer,
    agent: 'ORQUESTADOR',
    intent: message.intent,
    topic: message.topic,
    agentsUsed: message.agentsUsed,
    fragmentsUsed: message.fragmentsUsed,
    documentsCited: message.documentsCited,
    citations: message.citations,
    resolved: message.resolved,
    clarificationNeeded: message.clarificationNeeded,
    escalationSuggested: message.escalationSuggested,
    escalated: message.escalated,
    latencyMs: message.latencyMs
  };
}

function createChatRepository({
  writeConnectionFactory = getConnection,
  readConnectionFactory = getReadConnection,
  modelsFactory = initModels,
  now = () => new Date()
} = {}) {
  function writeModels() {
    return modelsFactory(writeConnectionFactory());
  }

  function readModels() {
    return modelsFactory(readConnectionFactory());
  }

  function existingResult(record, { userId, requestId, conversationId, question }) {
    if (record.pregunta !== question ||
      (conversationId && record.conversacion_id !== conversationId)) {
      throw new HttpError(409, 'El identificador de solicitud ya se usó con otra consulta.');
    }
    if (record.respuesta === null || record.respuesta === undefined) {
      return { status: 'IN_PROGRESS', messageId: record.id, conversationId: record.conversacion_id };
    }
    return {
      status: 'COMPLETED',
      messageId: record.id,
      conversationId: record.conversacion_id,
      response: cachedResponse(record)
    };
  }

  async function reserveMessage({ userId, requestId, conversationId = null, question }) {
    const sequelize = writeConnectionFactory();
    const models = modelsFactory(sequelize);
    const lookup = { usuario_id: userId, solicitud_idempotencia: requestId };

    try {
      return await sequelize.transaction(async (transaction) => {
        const existing = await models.ConsultaChat.findOne({
          where: lookup,
          transaction,
          ...(transaction.LOCK ? { lock: transaction.LOCK.UPDATE } : {})
        });
        if (existing) {
          const record = asPlain(existing);
          if (record.pregunta !== question || (conversationId && record.conversacion_id !== conversationId)) {
            throw new HttpError(409, 'El identificador de solicitud ya se usó con otra consulta.');
          }
          if (record.resolucion === 'ERROR') {
            await models.ConsultaChat.update({
              respuesta: null,
              intencion: null,
              tema: null,
              agentes_utilizados: [],
              citas_documentales: [],
              fragmentos_utilizados: [],
              documentos_citados: [],
              resolucion: null,
              latencia_ms: null,
              escalamiento_realizado: false,
              escalamiento_sugerido: false
            }, { where: { id: record.id, usuario_id: userId }, transaction });
            return { status: 'RESERVED', messageId: record.id, conversationId: record.conversacion_id, retry: true };
          }
          return existingResult(record, { userId, requestId, conversationId, question });
        }

        let conversation;
        if (conversationId) {
          conversation = await models.Conversacion.findOne({
            where: { id: conversationId, usuario_id: userId },
            transaction
          });
          if (!conversation) throw new HttpError(404, 'No se encontró la conversación solicitada.');
        } else {
          conversation = await models.Conversacion.create({
            id: randomUUID(),
            usuario_id: userId,
            titulo: 'Conversación de RRHH',
            creado_en: now(),
            actualizado_en: now()
          }, { transaction });
        }

        const collaborator = await models.Colaborador.findOne({
          where: { usuario_id: userId },
          attributes: ['id'],
          transaction
        });
        if (!collaborator) throw new HttpError(403, 'La cuenta autenticada no tiene un perfil de colaborador asociado.');
        const message = await models.ConsultaChat.create({
          id: randomUUID(),
          usuario_id: userId,
          colaborador_id: collaborator.id,
          conversacion_id: conversation.id,
          solicitud_idempotencia: requestId,
          pregunta: question,
          respuesta: null,
          agente: 'ORQUESTADOR',
          intencion: null,
          agentes_utilizados: [],
          citas_documentales: [],
          escalamiento_realizado: false,
          escalamiento_sugerido: false,
          tema: null,
          creado_en: now(),
          resolucion: null,
          latencia_ms: null,
          fragmentos_utilizados: [],
          documentos_citados: []
        }, { transaction });
        return {
          status: 'RESERVED',
          messageId: message.id,
          conversationId: conversation.id,
          createdConversation: !conversationId
        };
      });
    } catch (error) {
      if (error.name !== 'SequelizeUniqueConstraintError') throw error;
      const existing = await models.ConsultaChat.findOne({ where: lookup });
      if (!existing) throw error;
      return existingResult(asPlain(existing), { userId, requestId, conversationId, question });
    }
  }

  async function completeMessage({
    userId, messageId, response, intent, topic, agentsUsed,
    fragmentsUsed, citations, documentsCited, resolution, escalated, escalationSuggested = false, latencyMs
  }) {
    const sequelize = writeConnectionFactory();
    const models = modelsFactory(sequelize);
    await sequelize.transaction(async (transaction) => {
      const [updated] = await models.ConsultaChat.update({
        respuesta: response,
        agente: 'ORQUESTADOR',
        intencion: intent,
        agentes_utilizados: agentsUsed,
        tema: topic,
        resolucion: resolution,
        latencia_ms: latencyMs,
        fragmentos_utilizados: fragmentsUsed,
        citas_documentales: citations,
        documentos_citados: documentsCited,
        escalamiento_realizado: escalated,
        escalamiento_sugerido: escalationSuggested
      }, { where: { id: messageId, usuario_id: userId }, transaction });
      if (updated !== 1) throw new Error('No fue posible completar el registro de chat reservado.');

      const message = await models.ConsultaChat.findOne({
        where: { id: messageId, usuario_id: userId },
        attributes: ['conversacion_id'],
        transaction
      });
      if (!message) throw new Error('No se encontró la conversación asociada al mensaje.');
      await models.Conversacion.update({
        tema: topic,
        actualizado_en: now()
      }, {
        where: { id: message.conversacion_id, usuario_id: userId },
        transaction
      });
    });
  }

  async function failMessage({ userId, messageId, latencyMs }) {
    return completeMessage({
      userId,
      messageId,
      response: 'No pude procesar la consulta. Inténtalo de nuevo con un nuevo identificador de solicitud.',
      intent: null,
      topic: null,
      agentsUsed: [],
      fragmentsUsed: [],
      citations: [],
      documentsCited: [],
      resolution: 'ERROR',
      escalated: false,
      latencyMs
    });
  }

  async function listConversations(userId, limit = 50) {
    const { Conversacion } = readModels();
    const rows = await Conversacion.findAll({
      where: { usuario_id: userId },
      attributes: ['id', 'titulo', 'tema', 'creado_en', 'actualizado_en'],
      order: [['actualizado_en', 'DESC']],
      limit
    });
    return rows.map((item) => {
      const row = asPlain(item);
      return {
        id: row.id, title: row.titulo, topic: row.tema,
        createdAt: row.creado_en, updatedAt: row.actualizado_en
      };
    });
  }

  async function getHistory(userId, { conversationId = null, limit = 50 } = {}) {
    const { Conversacion, ConsultaChat } = readModels();
    if (conversationId) {
      const owner = await Conversacion.findOne({
        where: { id: conversationId, usuario_id: userId },
        attributes: ['id']
      });
      if (!owner) throw new HttpError(404, 'No se encontró la conversación solicitada.');
    }
    const where = { usuario_id: userId, ...(conversationId ? { conversacion_id: conversationId } : {}) };
    const rows = await ConsultaChat.findAll({
      where,
      attributes: MESSAGE_FIELDS,
      order: [['creado_en', 'DESC']],
      limit
    });
    return rows.reverse().map(publicMessage);
  }

  async function getConversation(userId, conversationId, limit = 100) {
    const { Conversacion, ConsultaChat } = readModels();
    const conversation = await Conversacion.findOne({
      where: { id: conversationId, usuario_id: userId },
      attributes: ['id', 'titulo', 'tema', 'creado_en', 'actualizado_en']
    });
    if (!conversation) throw new HttpError(404, 'No se encontró la conversación solicitada.');
    const rows = await ConsultaChat.findAll({
      where: { usuario_id: userId, conversacion_id: conversationId },
      attributes: MESSAGE_FIELDS,
      order: [['creado_en', 'ASC']],
      limit
    });
    const row = asPlain(conversation);
    return {
      id: row.id,
      title: row.titulo,
      topic: row.tema,
      createdAt: row.creado_en,
      updatedAt: row.actualizado_en,
      messages: rows.map(publicMessage)
    };
  }

  async function getConversationContext(userId, conversationId, limit = 3) {
    const { ConsultaChat } = readModels();
    const rows = await ConsultaChat.findAll({
      where: { usuario_id: userId, conversacion_id: conversationId, intencion: { [Op.ne]: null } },
      attributes: ['intencion', 'tema'],
      order: [['creado_en', 'DESC']],
      limit
    });
    return rows.reverse().map((record) => {
      const row = asPlain(record);
      return { intent: row.intencion, topic: row.tema };
    });
  }

  return {
    reserveMessage,
    completeMessage,
    failMessage,
    listConversations,
    getHistory,
    getConversation,
    getConversationContext
  };
}

const defaultRepository = createChatRepository();
module.exports = { MESSAGE_FIELDS, createChatRepository, publicMessage, cachedResponse, ...defaultRepository };
