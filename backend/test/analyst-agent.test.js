'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createAnalystAgent, localDate, reportQuestionMetric } = require('../src/services/analyst.agent');

function fixture() {
  return {
    active: [{ total: 8 }],
    absences: [{ tipo: 'INCAPACIDAD', departamento: 'Tecnología', colaboradores: 1 }, { tipo: 'VACACIONES', departamento: 'Operaciones', colaboradores: 2 }],
    pendingCount: [{ total: 4 }], pendingOlder: [{ total: 2 }],
    pendingRows: [{ id: 'request-1', codigo: 'NT-001', nombres: 'Persona', apellidos: 'Ficticia', departamento: 'Tecnología', tipo: 'VACACIONES', dias_solicitados: '3.00', fecha_inicio: '2026-11-20', fecha_fin: '2026-11-22', creado_en: new Date('2026-11-10T14:00:00Z'), dias_sin_respuesta: 8 }],
    activeIncapacities: [{ total: 2, colaboradores: 2 }], incapacityDays: [{ total: 7 }],
    movements: [{ ingresos: 2, salidas: 1 }], turnover: [{ dotacionInicial: 10, dotacionActual: 11, salidasAcumuladas: 2 }],
    vacations: [{ codigo: 'NT-002', nombres: 'Colab', apellidos: 'Ficticio', departamento: 'Tecnología', dias_disponibles: '22.50' }, { codigo: 'NT-003', nombres: 'Otra', apellidos: 'Ficticia', departamento: 'Operaciones', dias_disponibles: '21.00' }],
    chat: [{ total: 4, resueltasSinEscalamiento: 2, latenciaPromedio: '125.5' }],
    topics: [{ tema: 'VACACIONES', total: 3 }], unanswered: [{ pregunta: '¿Existe una licencia para mascotas?', intencion: 'POLITICA', creado_en: new Date('2026-11-17T12:00:00Z') }],
    trend: [{ fecha: '2026-11-18', colaboradores: 2 }], statuses: [{ estado: 'PENDIENTE', total: 4 }, { estado: 'APROBADA', total: 3 }]
  };
}

test('construye indicadores desde agregados MySQL, maneja ceros y selecciona hechos exactos para DeepSeek', async () => {
  const calls = { collect: [], save: [], deepseek: [] };
  let stored = null;
  const repository = {
    byDate: async () => stored,
    collectMetrics: async (parameters) => { calls.collect.push(parameters); return fixture(); },
    saveReport: async (report) => { calls.save.push(report); stored = report; return { ...report, updated: false }; },
    latest: async () => stored,
    history: async (limit) => [{ limit }]
  };
  const deepSeekService = { generateStructured: async (input, schema) => {
    const result = { sentences: ['active', 'absences', 'requests'] };
    calls.deepseek.push({ input, valid: schema.safeParse(result).success });
    return { data: result };
  } };
  const agent = createAnalystAgent({ repository, deepSeekService, now: () => new Date('2026-11-19T12:00:00Z'), logger: { warn() {} } });
  const result = await agent.generateDailyReport({ date: '2026-11-18' });
  const { report } = result;
  assert.equal(calls.deepseek[0].valid, true);
  assert.equal(report.indicators.activeCollaborators, 8);
  assert.equal(report.absences.totalPeople, 3);
  assert.equal(report.indicators.absentCollaboratorsToday, 3);
  assert.equal(report.requests.pendingCount, 4);
  assert.equal(report.requests.olderThanThreeDaysCount, 2);
  assert.equal(report.requests.pendingRows[0].daysWithoutResponse, 8);
  assert.equal(report.incapacities.activeCount, 2);
  assert.equal(report.incapacities.activeCollaborators, 2);
  assert.equal(report.incapacities.daysMonthToDate, 7);
  assert.deepEqual(report.turnover.month, { hires: 2, exits: 1 });
  assert.equal(report.turnover.yearToDate.ratePercent, 19.05);
  assert.equal(report.vacations.over20DaysCount, 2);
  assert.equal(report.chatbot.percentResolvedWithoutEscalation, 50);
  assert.equal(report.chatbot.averageLatencyMs, 125.5);
  assert.equal(report.chatbot.ragUnansweredQuestions.length, 1);
  assert.equal(report.absences.trend30Days.length, 30);
  assert.equal(report.absences.trend30Days.at(-1).collaborators, 2);
  assert.equal(report.requests.byStatus.length, 2);
  assert.equal(report.executiveSummary.origin, 'DEEPSEEK');
  assert.match(report.executiveSummary.text, /8 colaboradores/);
  assert.equal(calls.collect[0].dayStartUtc, '2026-11-17 06:00:00');
  assert.equal(calls.collect[0].dayEndUtc, '2026-11-18 06:00:00');
  assert.equal(calls.save.length, 1);
  assert.equal((await agent.generateDailyReport({ date: '2026-11-18' })).reused, true);
  assert.equal(calls.collect.length, 1);
});

test('si DeepSeek falla, conserva cifras SQL y marca el origen determinista', async () => {
  const repository = { byDate: async () => null, collectMetrics: async () => fixture(), saveReport: async (report) => report };
  const agent = createAnalystAgent({ repository, deepSeekService: { generateStructured: async () => { throw Object.assign(new Error(), { code: 'DEEPSEEK_TIMEOUT' }); } }, now: () => new Date('2026-11-18T12:00:00Z'), logger: { warn() {} } });
  const { report } = await agent.generateDailyReport({ date: '2026-11-18' });
  assert.equal(report.executiveSummary.origin, 'SQL_FALLBACK');
  assert.equal(report.executiveSummary.sentences.length, 5);
  assert.match(report.executiveSummary.text, /19\.05%/);
});

test('fecha inválida se rechaza y el porcentaje de chat de un día sin consultas es cero', async () => {
  const data = fixture();
  data.chat = [{ total: 0, resueltasSinEscalamiento: 0, latenciaPromedio: null }];
  const agent = createAnalystAgent({ repository: { byDate: async () => null, collectMetrics: async () => data, saveReport: async (report) => report }, deepSeekService: { generateStructured: async () => ({ data: { sentences: ['active', 'absences', 'requests'] } }) }, now: () => new Date('2026-11-18T12:00:00Z') });
  await assert.rejects(agent.generateDailyReport({ date: '2026-02-30' }), { status: 400 });
  const { report } = await agent.generateDailyReport({ date: '2026-11-18' });
  assert.equal(report.chatbot.percentResolvedWithoutEscalation, 0);
  assert.equal(report.chatbot.averageLatencyMs, null);
  assert.equal(localDate(new Date('2026-11-19T03:00:00Z')), '2026-11-18');
});

test('responde consultas estadísticas únicamente a RRHH usando el último reporte guardado', async () => {
  let latestCalls = 0;
  const agent = createAnalystAgent({ repository: { latest: async () => { latestCalls += 1; return { reportDate: '2026-11-18', executiveSummary: { text: 'Resumen almacenado.' } }; } } });
  await assert.rejects(agent.answerQuestion({ question: 'indicadores', role: 'COLABORADOR' }), { status: 403 });
  assert.equal(latestCalls, 0);
  const result = await agent.answerQuestion({ question: 'indicadores', role: 'RRHH' });
  assert.match(result.answer, /Resumen almacenado/);
  assert.equal(result.source, 'MySQL: reportes_diarios');
  assert.deepEqual(result.citations, []);
});

test('responde indicadores específicos desde la instantánea almacenada y pide aclaración si no reconoce el tema', async () => {
  assert.equal(reportQuestionMetric('¿Cuál fue la tasa de rotación?'), 'turnover');
  const report = { reportDate: '2026-11-18', indicators: { activeCollaborators: 12 }, executiveSummary: { text: 'Resumen guardado.' } };
  const agent = createAnalystAgent({ repository: { latest: async () => report } });
  const result = await agent.answerQuestion({ question: '¿Cuántos colaboradores activos hubo?', role: 'RRHH' });
  assert.equal(result.answer, 'Reporte diario almacenado del 2026-11-18. Colaboradores activos al 2026-11-18: 12.');
  assert.equal(result.source, 'MySQL: reportes_diarios');
  const unclear = await agent.answerQuestion({ question: 'Muéstrame el contexto general', role: 'RRHH' });
  assert.equal(unclear.resolved, false);
  assert.match(unclear.answer, /Qué indicador/);
});
