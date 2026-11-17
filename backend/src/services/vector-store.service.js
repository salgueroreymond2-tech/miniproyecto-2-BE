'use strict';

const { randomUUID } = require('node:crypto');
const { Op, Transaction } = require('sequelize');
const { z } = require('zod');
const { getConnection } = require('../config/database');
const { initModels } = require('../models');

const MODEL = 'Xenova/multilingual-e5-small';
const DIMENSIONS = 384;
const categories = ['POLITICA', 'PROCEDIMIENTO', 'DOCUMENTO_PUBLICO'];
const vector = z.array(z.number().finite()).length(DIMENSIONS).refine((values) => {
  const magnitude = Math.hypot(...values);
  return magnitude > 0 && Number.isFinite(magnitude);
}, 'El vector debe tener una magnitud finita y distinta de cero.');
const chunkSchema = z.strictObject({
  document_id: z.string().uuid(), drive_file_id: z.string().min(1).max(255),
  title: z.string().min(1).max(250), content: z.string().min(1).max(20000),
  section: z.string().max(250).nullable().optional(), page_number: z.number().int().positive().nullable().optional(),
  chunk_index: z.number().int().nonnegative(), version: z.string().min(1).max(32),
  source_url: z.string().url().nullable().optional(), category: z.enum(categories),
  effective_date: z.iso.date().nullable().optional(), content_hash: z.string().regex(/^[a-f0-9]{64}$/),
  embedding_model: z.literal(MODEL), embedding: vector,
  metadata: z.strictObject({ source_type: z.enum(categories).optional() }).default({})
});

async function lockDocument(documentId, transaction) {
  const models = initModels();
  // Todas las escrituras de fragmentos bloquean primero el mismo documento para serializar publicaciones.
  const doc = await models.Documento.findByPk(documentId, { transaction, lock: transaction.LOCK.UPDATE });
  if (!doc) throw new Error('El documento no existe en MySQL.');
  return doc;
}

async function checkConnection() {
  await initModels().DocumentChunk.count();
  return { connected: true };
}

async function insertChunk(input) {
  const data = chunkSchema.parse(input);
  const models = initModels();
  return getConnection().transaction(async (transaction) => {
    await lockDocument(data.document_id, transaction);
    const where = { document_id: data.document_id, version: data.version, chunk_index: data.chunk_index };
    const existing = await models.DocumentChunk.findOne({ where, transaction });
    if (existing) {
      if (existing.content_hash !== data.content_hash) throw new Error('La posición ya existe con contenido distinto; cree una nueva versión.');
      return { id: existing.id };
    }
    const created = await models.DocumentChunk.create({ id: randomUUID(), ...data, validation_status: 'PENDIENTE', is_active: false }, { transaction });
    return { id: created.id };
  });
}

async function updateChunk(id, input) {
  z.string().uuid().parse(id);
  const data = chunkSchema.parse(input);
  const models = initModels();
  return getConnection().transaction(async (transaction) => {
    await lockDocument(data.document_id, transaction);
    const chunk = await models.DocumentChunk.findOne({ where: { id, document_id: data.document_id }, transaction, lock: transaction.LOCK.UPDATE });
    if (!chunk || chunk.is_active) throw new Error('No existe un fragmento inactivo editable para este documento.');
    await chunk.update({ ...data, validation_status: 'PENDIENTE' }, { transaction });
    return { id: chunk.id };
  });
}

async function deleteChunk(id) {
  z.string().uuid().parse(id);
  const models = initModels();
  return getConnection().transaction(async (transaction) => {
    const initial = await models.DocumentChunk.findByPk(id, { attributes: ['document_id'], transaction });
    if (!initial) return;
    await lockDocument(initial.document_id, transaction);
    const chunk = await models.DocumentChunk.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!chunk) return;
    if (chunk.is_active) throw new Error('No se puede eliminar un fragmento activo de una versión publicada.');
    await chunk.destroy({ transaction });
  });
}

async function publishVersion(documentId, version, expectedCount) {
  z.string().uuid().parse(documentId);
  z.string().trim().min(1).max(32).parse(version);
  z.number().int().min(1).max(10000).parse(expectedCount);
  const models = initModels();
  return getConnection().transaction(async (transaction) => {
    const doc = await lockDocument(documentId, transaction);
    if (doc.estado !== 'VALIDADO' || doc.version !== version) throw new Error('La versión del documento debe estar validada antes de publicarse.');
    const chunks = await models.DocumentChunk.findAll({ attributes: ['chunk_index'], where: { document_id: documentId, version, validation_status: { [Op.ne]: 'ELIMINADO' } }, order: [['chunk_index', 'ASC']], transaction });
    if (chunks.length !== expectedCount || chunks.some((chunk, i) => chunk.chunk_index !== i)) throw new Error('La versión está incompleta.');
    await models.DocumentChunk.update({ is_active: false }, { where: { document_id: documentId, is_active: true }, transaction });
    await models.DocumentChunk.update({ is_active: true, validation_status: 'VALIDADO' }, { where: { document_id: documentId, version, validation_status: { [Op.ne]: 'ELIMINADO' } }, transaction });
    return chunks.length;
  });
}

function similarity(left, right) {
  const leftNorm = Math.hypot(...left);
  const rightNorm = Math.hypot(...right);
  let sum = 0;
  for (let i = 0; i < DIMENSIONS; i += 1) sum += (left[i] / leftNorm) * (right[i] / rightNorm);
  return Math.max(-1, Math.min(1, sum));
}

async function searchDocuments(embedding, threshold = Number(process.env.RAG_SIMILARITY_THRESHOLD || 0.75), count = Number(process.env.RAG_TOP_K || 5)) {
  vector.parse(embedding);
  z.number().min(0).max(1).parse(threshold);
  z.number().int().min(1).max(20).parse(count);
  const models = initModels();
  const top = [];
  // Escaneo exacto por lotes bajo una instantánea estable; no depende de extensiones vectoriales.
  return getConnection().transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ }, async (transaction) => {
    let lastId = '';
    for (;;) {
      const chunks = await models.DocumentChunk.findAll({
        attributes: ['id', 'content', 'title', 'section', 'version', 'source_url', 'embedding'],
        where: { id: { [Op.gt]: lastId }, is_active: true, validation_status: 'VALIDADO', embedding_model: MODEL },
        include: [{ model: models.Documento, attributes: [], required: true, where: { estado: 'VALIDADO' } }],
        order: [['id', 'ASC']], limit: 100, raw: true, transaction
      });
      if (!chunks.length) break;
      for (const chunk of chunks) {
        const stored = vector.parse(typeof chunk.embedding === 'string' ? JSON.parse(chunk.embedding) : chunk.embedding);
        const score = similarity(embedding, stored);
        if (score >= threshold) {
          const { embedding: _embedding, ...result } = chunk;
          top.push({ ...result, similarity: score });
          top.sort((a, b) => b.similarity - a.similarity || a.id.localeCompare(b.id));
          if (top.length > count) top.pop();
        }
      }
      lastId = chunks[chunks.length - 1].id;
    }
    return top;
  });
}

async function filterDocuments(category) {
  z.enum(categories).parse(category);
  const models = initModels();
  return models.DocumentChunk.findAll({ attributes: ['id', 'document_id', 'title', 'section', 'version', 'source_url'], where: { category, validation_status: 'VALIDADO', is_active: true }, include: [{ model: models.Documento, attributes: [], required: true, where: { estado: 'VALIDADO' } }], raw: true });
}

module.exports = { MODEL, DIMENSIONS, vector, chunkSchema, similarity, checkConnection, insertChunk, updateChunk, deleteChunk, searchDocuments, filterDocuments, publishVersion };
