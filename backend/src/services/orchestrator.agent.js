'use strict';

const { performance } = require('node:perf_hooks');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { z } = require('zod');
const { createDeepSeekService } = require('./deepseek.service');
const policiesAgent = require('./policies.agent');
const employeeDataAgent = require('./employee-data.agent');
const analystAgentDefault = require('./analyst.agent');
const chatRepository = require('../repositories/chatRepository');
const HttpError = require('../utils/httpError');

const AGENT_NAME = 'ORQUESTADOR';
const INTENTS = ['POLITICA', 'DATO_PERSONAL', 'MIXTA', 'REPORTE', 'RESTRINGIDA', 'FUERA_DE_ALCANCE'];
const TOPICS = [
  'VACACIONES', 'FERIADOS', 'PERMISOS', 'INCAPACIDADES', 'JORNADA', 'TELETRABAJO',
  'REMUNERACION', 'PAGOS', 'BENEFICIOS', 'ONBOARDING', 'SALIDA', 'DESEMPENO',
  'CONDUCTA', 'DENUNCIAS', 'DATOS_PERSONALES', 'REPORTES', 'GENERAL', 'OTRO'
];
const classificationSchema = z.strictObject({
  intent: z.enum(INTENTS),
  topic: z.enum(TOPICS),
  confidence: z.number().min(0).max(1),
  needsClarification: z.boolean()
});
const inputSchema = z.strictObject({
  question: z.string().trim().min(1).max(4000),
  userId: z.string().uuid(),
  role: z.enum(['COLABORADOR', 'RRHH']),
  requestId: z.string().uuid(),
  conversationId: z.string().uuid().nullable().default(null)
});
const contextSchema = z.array(z.strictObject({
  intent: z.enum(INTENTS),
  topic: z.enum(TOPICS)
})).max(3);
const DEFAULT_CONFIDENCE_THRESHOLD = 0.65;
const MAX_CONTEXT_TURNS = 3;

function readPrompt() {
  return readFileSync(join(__dirname, '../prompts/orchestrator.prompt.v1.md'), 'utf8');
}

function confidenceThreshold(value = process.env.ORCHESTRATOR_CONFIDENCE_THRESHOLD ?? DEFAULT_CONFIDENCE_THRESHOLD) {
  const result = z.coerce.number().finite().min(0).max(1).safeParse(value);
  if (!result.success) throw new Error('ORCHESTRATOR_CONFIDENCE_THRESHOLD debe estar entre 0 y 1.');
  return result.data;
}

function normalizedQuestion(question) {
  return question.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

function restrictedQuestion(question) {
  const normalized = normalizedQuestion(question);
  const asksSalary = /\b(salario|sueldo|remuneracion|planilla|compensacion individual)\b/.test(normalized);
  const asksPersonalRecords = /\b(vacaciones?|saldo|incapacidades?|permisos?|ausencias?|evaluacion|desempeno|pago individual)\b/.test(normalized);
  const targetsAnotherPerson = /\b(companer[oa]s?|colegas?|gerente|jefe|supervisor|otra persona|alguien mas|de juan)\b/.test(normalized) ||
    (asksPersonalRecords && /\b(tiene|le quedan|le corresponde|su expediente)\b/.test(normalized) && !/\b(mi|mis|me|mio|mia|propio|propia)\b/.test(normalized));
  return asksSalary || (asksPersonalRecords && targetsAnotherPerson);
}

function restrictedTopic(question) {
  const normalized = normalizedQuestion(question);
  if (/\b(salario|sueldo|remuneracion|planilla|compensacion)\b/.test(normalized)) return 'REMUNERACION';
  if (/\b(vacaciones?|saldo)\b/.test(normalized)) return 'VACACIONES';
  return 'DATOS_PERSONALES';
}

function restrictedOutcome() {
  return {
    answer: 'No puedo consultar ni revelar información privada de otras personas o datos salariales. Consulta a RRHH por el canal autorizado.',
    resolved: true,
    escalationSuggested: false,
    escalated: false,
    citations: [],
    fragmentsUsed: [],
    documentsCited: [],
    agentsUsed: [],
    resolution: 'RESPONDIDA'
  };
}

function contextualQuestion(question, history) {
  if (history.length === 0) return question;
  const topics = [...new Set(history.slice(-2).map((turn) => turn.topic))];
  return 'Temas previos de esta conversación: ' + topics.join(', ') + '. Pregunta actual: ' + question;
}

function clarificationOutcome() {
  return {
    answer: 'No pude clasificar la consulta con suficiente claridad. ¿Puedes precisar qué necesitas saber sobre Recursos Humanos?',
    resolved: false,
    escalationSuggested: false,
    escalated: false,
    citations: [],
    fragmentsUsed: [],
    documentsCited: [],
    agentsUsed: [],
    resolution: 'SIN_EVIDENCIA'
  };
}

function agentFailure(error) {
  if (error instanceof HttpError) return error;
  if (error.name === 'ZodError') return new HttpError(502, 'El clasificador devolvió una respuesta inválida.');
  if (String(error.code || '').startsWith('DEEPSEEK_')) return new HttpError(503, 'El servicio de IA no está disponible temporalmente.');
  if (error.code === 'DATABASE_NOT_CONFIGURED' ||
    String(error.name || '').startsWith('SequelizeConnection') ||
    ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'ER_ACCESS_DENIED_ERROR'].includes(error.code)) {
    return new HttpError(503, 'La memoria de conversaciones no está disponible temporalmente.');
  }
  return error;
}

function createOrchestratorAgent({
  repository = chatRepository,
  policyAgent = policiesAgent,
  personalDataAgent = employeeDataAgent,
  analystAgent = analystAgentDefault,
  deepSeekService = createDeepSeekService(),
  systemPrompt = readPrompt(),
  minConfidence = process.env.ORCHESTRATOR_CONFIDENCE_THRESHOLD ?? DEFAULT_CONFIDENCE_THRESHOLD
} = {}) {
  const threshold = confidenceThreshold(minConfidence);

  async function classify(question, context) {
    const result = await deepSeekService.generateStructured({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: JSON.stringify({ pregunta: question, contexto: context }) }
      ],
      maxTokens: 160
    }, classificationSchema);
    return classificationSchema.parse(result.data);
  }

  async function routeIntent(intent, question, userId, role) {
    if (intent === 'POLITICA') {
      const result = await policyAgent.answer({ question, userId, persistAudit: false });
      return {
        answer: result.answer,
        resolved: result.resolution === 'RESPONDIDA',
        escalationSuggested: false,
        escalated: false,
        citations: result.citations || [],
        fragmentsUsed: result.retrievedFragments || [],
        documentsCited: result.documentsCited || [],
        agentsUsed: ['POLITICAS'],
        resolution: result.resolution === 'RESPONDIDA' ? 'RESPONDIDA' : 'SIN_EVIDENCIA'
      };
    }

    if (intent === 'DATO_PERSONAL') {
      const result = await personalDataAgent.answer({ question, authenticatedUserId: userId });
      return {
        answer: result.answer,
        resolved: result.resolved,
        escalationSuggested: result.escalationSuggested,
        escalated: result.escalated,
        citations: result.citations || [],
        fragmentsUsed: [],
        documentsCited: [],
        agentsUsed: ['DATOS_COLABORADOR'],
        resolution: result.resolved ? 'RESPONDIDA' : 'SIN_EVIDENCIA'
      };
    }

    if (intent === 'MIXTA') {
      const [policyResult, personalResult] = await Promise.all([
        policyAgent.answer({ question, userId, persistAudit: false }),
        personalDataAgent.answer({ question, authenticatedUserId: userId })
      ]);
      const policyResolved = policyResult.resolution === 'RESPONDIDA';
      const resolved = policyResolved && personalResult.resolved;
      return {
        answer: policyResult.answer + '\n\n' + personalResult.answer,
        resolved,
        escalationSuggested: Boolean(personalResult.escalationSuggested),
        escalated: Boolean(personalResult.escalated),
        // Se devuelven intactas las referencias construidas por el agente RAG.
        citations: policyResult.citations || [],
        fragmentsUsed: policyResult.retrievedFragments || [],
        documentsCited: policyResult.documentsCited || [],
        agentsUsed: ['POLITICAS', 'DATOS_COLABORADOR'],
        resolution: resolved ? 'RESPONDIDA' : 'SIN_EVIDENCIA'
      };
    }

    if (intent === 'REPORTE') {
      if (role !== 'RRHH') {
        return { ...restrictedOutcome(), answer: 'No tienes autorización para consultar reportes de Recursos Humanos.', escalationSuggested: true };
      }
      const result = await analystAgent.answerQuestion({ question, role });
      return {
        answer: result.answer,
        resolved: result.resolved,
        escalationSuggested: result.escalationSuggested,
        escalated: result.escalated,
        citations: result.citations || [],
        fragmentsUsed: [],
        documentsCited: [],
        agentsUsed: result.agentsUsed || ['ANALISTA'],
        source: result.source || 'MySQL: reportes_diarios',
        resolution: result.resolved ? 'RESPONDIDA' : 'SIN_EVIDENCIA'
      };
    }

    if (intent === 'RESTRINGIDA') return restrictedOutcome();
    return {
      answer: 'Este asistente atiende consultas de Recursos Humanos sobre políticas y registros propios. ¿Qué tema de RRHH necesitas revisar?',
      resolved: true,
      escalationSuggested: false,
      escalated: false,
      citations: [],
      fragmentsUsed: [],
      documentsCited: [],
      agentsUsed: [],
      resolution: 'RESPONDIDA'
    };
  }

  async function answer(input) {
    const parsed = inputSchema.parse(input);
    const startedAt = performance.now();
    const reservation = await repository.reserveMessage({
      userId: parsed.userId,
      requestId: parsed.requestId,
      conversationId: parsed.conversationId,
      question: parsed.question
    });
    if (reservation.status === 'COMPLETED') return reservation.response;
    if (reservation.status === 'IN_PROGRESS') throw new HttpError(409, 'La consulta con este identificador todavía está en proceso.');

    try {
      const rawContext = await repository.getConversationContext(parsed.userId, reservation.conversationId, MAX_CONTEXT_TURNS);
      const context = contextSchema.parse(rawContext);
      const currentQuestion = contextualQuestion(parsed.question, context);
      let classification;
      if (restrictedQuestion(parsed.question)) {
        classification = {
          intent: 'RESTRINGIDA',
          topic: restrictedTopic(parsed.question),
          confidence: 1,
          needsClarification: false
        };
      } else {
        classification = await classify(parsed.question, context);
      }

      const reportDenied = classification.intent === 'REPORTE' && parsed.role !== 'RRHH';
      if (reportDenied) {
        classification = { ...classification, intent: 'RESTRINGIDA' };
      }

      const unclear = classification.needsClarification || classification.confidence < threshold;
      const intent = unclear ? null : classification.intent;
      const outcome = unclear
        ? clarificationOutcome()
        : reportDenied
          ? { ...restrictedOutcome(), answer: 'No tienes autorización para consultar reportes de Recursos Humanos.', escalationSuggested: true }
          : await routeIntent(classification.intent, currentQuestion, parsed.userId, parsed.role);
      const latencyMs = Math.round(performance.now() - startedAt);
      const response = {
        messageId: reservation.messageId,
        conversationId: reservation.conversationId,
        answer: outcome.answer,
        agent: AGENT_NAME,
        intent,
        topic: classification.topic,
        agentsUsed: outcome.agentsUsed,
        source: outcome.source || null,
        fragmentsUsed: outcome.fragmentsUsed,
        documentsCited: outcome.documentsCited,
        citations: outcome.citations,
        resolved: outcome.resolved,
        clarificationNeeded: unclear,
        escalationSuggested: outcome.escalationSuggested,
        escalated: outcome.escalated,
        latencyMs
      };
      await repository.completeMessage({
        userId: parsed.userId,
        messageId: reservation.messageId,
        response: outcome.answer,
        intent,
        topic: classification.topic,
        agentsUsed: outcome.agentsUsed,
        fragmentsUsed: outcome.fragmentsUsed,
        citations: outcome.citations,
        documentsCited: outcome.documentsCited,
        resolution: outcome.resolution,
        escalated: outcome.escalated,
        escalationSuggested: outcome.escalationSuggested,
        latencyMs
      });
      return response;
    } catch (error) {
      const latencyMs = Math.round(performance.now() - startedAt);
      try {
        await repository.failMessage({ userId: parsed.userId, messageId: reservation.messageId, latencyMs });
      } catch (persistenceError) {
        throw new AggregateError([error, persistenceError], 'La consulta falló y no fue posible cerrar su registro en MySQL.');
      }
      throw agentFailure(error);
    }
  }

  return {
    answer,
    listConversations: (userId, limit) => repository.listConversations(userId, limit),
    getHistory: (userId, options) => repository.getHistory(userId, options),
    getConversation: (userId, conversationId, limit) => repository.getConversation(userId, conversationId, limit)
  };
}

const defaultAgent = createOrchestratorAgent();
module.exports = {
  AGENT_NAME,
  INTENTS,
  TOPICS,
  classificationSchema,
  inputSchema,
  restrictedQuestion,
  contextualQuestion,
  createOrchestratorAgent,
  ...defaultAgent
};
