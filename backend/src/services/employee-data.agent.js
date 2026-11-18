'use strict';

const { performance } = require('node:perf_hooks');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { z } = require('zod');
const { createDeepSeekService } = require('./deepseek.service');
const employeeDataRepository = require('../repositories/employeeDataRepository');

const AGENT_NAME = 'DATOS_COLABORADOR';
const SOURCE = 'Fuente de datos: MySQL.';
const TOOL_NAMES = [
  'getVacationBalance',
  'getEmployeeRequests',
  'getRequestStatus',
  'getNextPayment',
  'getEmployeeAbsences',
  'getNextPerformanceEvaluation'
];
const clarificationSchema = z.enum(['SOLICITUD_ID', 'TEMA', 'PREGUNTA_AMBIGUA']);
const selectionOutputSchema = z.strictObject({
  action: z.enum(['CALL_TOOL', 'CLARIFY']),
  tool: z.enum(TOOL_NAMES).nullable(),
  requestId: z.string().uuid().nullable(),
  clarification: clarificationSchema.nullable()
});
const selectionSchema = selectionOutputSchema.superRefine((selection, context) => {
  if (selection.action === 'CALL_TOOL') {
    if (selection.tool === null || selection.clarification !== null) {
      context.addIssue({ code: 'custom', message: 'La selección de herramienta no es válida.' });
    }
    if (selection.tool !== 'getRequestStatus' && selection.requestId !== null) {
      context.addIssue({ code: 'custom', message: 'La herramienta no admite requestId.' });
    }
  } else if (selection.tool !== null || selection.requestId !== null || selection.clarification === null) {
    context.addIssue({ code: 'custom', message: 'La solicitud de aclaración no es válida.' });
  }
});
const answerInputSchema = z.strictObject({
  question: z.string().trim().min(1).max(2000),
  authenticatedUserId: z.string().uuid()
});
const toolArgumentSchemas = {
  getVacationBalance: z.strictObject({}),
  getEmployeeRequests: z.strictObject({}),
  getRequestStatus: z.strictObject({ requestId: z.string().uuid() }),
  getNextPayment: z.strictObject({}),
  getEmployeeAbsences: z.strictObject({}),
  getNextPerformanceEvaluation: z.strictObject({})
};
const clarificationAnswers = {
  SOLICITUD_ID: 'Indícame el UUID completo de la solicitud para consultar su estado.',
  TEMA: '¿Qué información personal necesitas consultar: vacaciones, solicitudes, pagos, ausencias o evaluación?',
  PREGUNTA_AMBIGUA: '¿Puedes precisar qué dato propio necesitas consultar?'
};

function readSystemPrompt() {
  return readFileSync(join(__dirname, '../prompts/employee-data.prompt.md'), 'utf8');
}

function formatDate(value) {
  if (value === null || value === undefined) return 'sin fecha registrada';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function withSource(text) {
  return text + '\n\n' + SOURCE;
}

function buildToolAnswer(tool, data) {
  if (data?.profileFound === false) {
    return {
      answer: withSource('No existe un perfil de colaborador asociado a la sesión autenticada. Contacta a RRHH.'),
      resolved: false,
      escalationSuggested: true
    };
  }

  if (tool === 'getVacationBalance') {
    if (data.length === 0) return {
      answer: withSource('No hay saldos de vacaciones registrados para tu perfil. Contacta a RRHH para revisar el registro.'),
      resolved: true,
      escalationSuggested: true
    };
    const periods = data.map((row) => (
      'Período ' + row.periodo_anual +
      ': días generados/asignados ' + row.dias_generados +
      ', ajuste ' + row.dias_ajuste +
      ', disfrutados ' + row.dias_disfrutados +
      ', disponibles ' + row.dias_disponibles + '.'
    ));
    return { answer: withSource(periods.join('\n')), resolved: true, escalationSuggested: false };
  }

  if (tool === 'getEmployeeRequests') {
    if (data.length === 0) return {
      answer: withSource('No tienes solicitudes registradas en el sistema.'),
      resolved: true,
      escalationSuggested: false
    };
    const requests = data.map((row) => (
      row.id + ' — ' + row.tipo + ', ' + formatDate(row.fecha_inicio) + ' a ' +
      formatDate(row.fecha_fin) + ', estado ' + row.estado +
      ', días solicitados ' + row.dias_solicitados + '.'
    ));
    return {
      answer: withSource('Solicitudes registradas (hasta 100 más recientes):\n' + requests.join('\n')),
      resolved: true,
      escalationSuggested: false
    };
  }

  if (tool === 'getRequestStatus') {
    if (!data) return {
      answer: withSource('No encontré una solicitud con ese identificador dentro de tus propios registros. Contacta a RRHH si necesitas verificarla.'),
      resolved: true,
      escalationSuggested: true
    };
    return {
      answer: withSource('Solicitud ' + data.id + ': ' + data.tipo + ', estado ' + data.estado +
        ', período ' + formatDate(data.fecha_inicio) + ' a ' + formatDate(data.fecha_fin) + '.'),
      resolved: true,
      escalationSuggested: false
    };
  }

  if (tool === 'getNextPayment') {
    if (!data) return {
      answer: withSource('No hay una fecha de pago futura programada en el calendario. Contacta a RRHH para confirmarla.'),
      resolved: true,
      escalationSuggested: true
    };
    return {
      answer: withSource('El próximo pago está programado para ' + formatDate(data.fecha_pago) +
        ' (' + data.tipo + '). Período de corte: ' + formatDate(data.fecha_corte_inicio) +
        ' a ' + formatDate(data.fecha_corte_fin) + '.'),
      resolved: true,
      escalationSuggested: false
    };
  }

  if (tool === 'getEmployeeAbsences') {
    if (data.length === 0) return {
      answer: withSource('No constan ausencias, permisos o incapacidades en tus registros.'),
      resolved: true,
      escalationSuggested: false
    };
    const events = data.map((row) => (
      row.tipo + ': ' + formatDate(row.fecha_inicio) + ' a ' +
      formatDate(row.fecha_fin) + ', estado ' + row.estado + '.'
    ));
    return { answer: withSource(events.join('\n')), resolved: true, escalationSuggested: false };
  }

  if (tool === 'getNextPerformanceEvaluation') {
    if (!data) return {
      answer: withSource('No hay una evaluación futura programada en tus registros. Contacta a RRHH para consultar la planificación.'),
      resolved: true,
      escalationSuggested: true
    };
    return {
      answer: withSource('Tu próxima evaluación está registrada para el período ' +
        formatDate(data.periodo_inicio) + ' a ' + formatDate(data.periodo_fin) +
        ', estado ' + data.estado + '.'),
      resolved: true,
      escalationSuggested: false
    };
  }

  throw new TypeError('Herramienta no autorizada.');
}

function createEmployeeDataAgent({
  repository = employeeDataRepository,
  deepSeekService = createDeepSeekService(),
  systemPrompt = readSystemPrompt()
} = {}) {
  async function answer(input) {
    const { question, authenticatedUserId } = answerInputSchema.parse(input);
    const startedAt = performance.now();
    const generated = await deepSeekService.generateStructured({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: JSON.stringify({ pregunta: question }) }
      ],
      maxTokens: 256
    }, selectionOutputSchema);
    const selection = selectionSchema.parse(generated.data);
    let outcome;
    const asksSingleRequestStatus = /(?:estado|estatus)\s+(?:de\s+)?(?:mi|la|una|esta)\s+solicitud\b|(?:mi|la|una|esta)\s+solicitud\b.*(?:estado|estatus)/i.test(question);

    if (selection.action === 'CLARIFY') {
      outcome = {
        answer: withSource(clarificationAnswers[selection.clarification]),
        resolved: false,
        escalationSuggested: false
      };
    } else if (asksSingleRequestStatus && !/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i.test(question)) {
      outcome = {
        answer: withSource(clarificationAnswers.SOLICITUD_ID),
        resolved: false,
        escalationSuggested: false
      };
    } else if (selection.tool === 'getRequestStatus' &&
      (!selection.requestId || !question.toLowerCase().includes(selection.requestId.toLowerCase()))) {
      outcome = {
        answer: withSource(clarificationAnswers.SOLICITUD_ID),
        resolved: false,
        escalationSuggested: false
      };
    } else {
      const args = selection.tool === 'getRequestStatus' ? { requestId: selection.requestId } : {};
      const validatedArgs = toolArgumentSchemas[selection.tool].parse(args);
      // Solo el servidor proporciona la identidad; argumentos del cliente/LLM no pueden reemplazarla.
      const result = await repository[selection.tool](authenticatedUserId, ...Object.values(validatedArgs));
      outcome = buildToolAnswer(selection.tool, result);
    }

    return {
      answer: outcome.answer,
      agent: AGENT_NAME,
      citations: [],
      resolved: outcome.resolved,
      escalationSuggested: outcome.escalationSuggested,
      escalated: false,
      latencyMs: Math.max(0, Math.round(performance.now() - startedAt))
    };
  }

  return { answer };
}

const defaultAgent = createEmployeeDataAgent();
module.exports = {
  AGENT_NAME,
  TOOL_NAMES,
  selectionOutputSchema,
  selectionSchema,
  answerInputSchema,
  toolArgumentSchemas,
  buildToolAnswer,
  createEmployeeDataAgent,
  ...defaultAgent
};
