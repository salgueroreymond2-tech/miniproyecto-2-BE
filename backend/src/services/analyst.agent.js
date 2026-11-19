'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { z } = require('zod');
const { createDeepSeekService } = require('./deepseek.service');
const { createReportRepository } = require('../repositories/reportRepository');
const { initModels } = require('../models');
const { matchingKeyword } = require('../utils/keywordMatcher');
const HttpError = require('../utils/httpError');

const TIME_ZONE = 'America/Costa_Rica';
const AGENT_NAME = 'ANALISTA';
const reportDateSchema = z.iso.date();
const REPORT_METRIC_IDS = [
  'summary', 'activeCollaborators', 'absences', 'absenceTrend', 'requestStatuses', 'turnover',
  'incapacities', 'vacations', 'ragUnanswered', 'chatbot', 'movements', 'pendingRequests', 'unknown'
];
const reportMetricSchema = z.strictObject({ metric: z.enum(REPORT_METRIC_IDS), confidence: z.number().min(0).max(1) });
const REPORT_METRIC_OPTIONS = [
  { id: 'summary', description: 'Executive summary stored in the daily report.' },
  { id: 'activeCollaborators', description: 'Active collaborator headcount.' },
  { id: 'absences', description: 'People absent on the report date, by type and department.' },
  { id: 'absenceTrend', description: 'Absence trend across the 30-day chart.' },
  { id: 'requestStatuses', description: 'Requests grouped by approval status.' },
  { id: 'turnover', description: 'Year-to-date turnover rate.' },
  { id: 'incapacities', description: 'Active incapacity cases and accumulated days.' },
  { id: 'vacations', description: 'Collaborators with more than 20 available vacation days.' },
  { id: 'ragUnanswered', description: 'Policy questions the RAG system could not answer.' },
  { id: 'chatbot', description: 'Previous-day chat volume, resolution, latency and top themes.' },
  { id: 'movements', description: 'Current-month hires and exits.' },
  { id: 'pendingRequests', description: 'Requests awaiting approval, including those overdue.' },
  { id: 'unknown', description: 'No report indicator matches the question clearly.' }
];
const reportSchema = z.object({
  reportDate: reportDateSchema,
  indicators: z.object({ activeCollaborators: z.number().int().nonnegative(), absentCollaboratorsToday: z.number().int().nonnegative(), pendingRequests: z.number().int().nonnegative(), activeIncapacities: z.number().int().nonnegative(), vacationBalancesOver20: z.number().int().nonnegative() }),
  absences: z.object({ byTypeDepartment: z.array(z.object({ type: z.string(), department: z.string(), collaborators: z.number().int().nonnegative() })), totalPeople: z.number().int().nonnegative(), trend30Days: z.array(z.object({ date: reportDateSchema, collaborators: z.number().int().nonnegative() })).length(30) }),
  requests: z.object({ pendingCount: z.number().int().nonnegative(), olderThanThreeDaysCount: z.number().int().nonnegative(), pendingRows: z.array(z.object({ id: z.string(), code: z.string(), name: z.string(), department: z.string(), type: z.string(), requestedDays: z.number().nonnegative(), startDate: reportDateSchema, endDate: reportDateSchema, createdAt: z.string(), daysWithoutResponse: z.number().int().nonnegative() })), byStatus: z.array(z.object({ status: z.string(), count: z.number().int().nonnegative() })) }),
  incapacities: z.object({ activeCount: z.number().int().nonnegative(), activeCollaborators: z.number().int().nonnegative(), daysMonthToDate: z.number().int().nonnegative() }),
  turnover: z.object({ month: z.object({ hires: z.number().int().nonnegative(), exits: z.number().int().nonnegative() }), yearToDate: z.object({ openingHeadcount: z.number().int().nonnegative(), currentHeadcount: z.number().int().nonnegative(), distinctExits: z.number().int().nonnegative(), ratePercent: z.number().finite().nonnegative() }) }),
  vacations: z.object({ over20DaysCount: z.number().int().nonnegative(), collaborators: z.array(z.object({ code: z.string(), name: z.string(), department: z.string(), availableDays: z.number().nonnegative() })) }),
  chatbot: z.object({ previousDay: reportDateSchema, totalQueries: z.number().int().nonnegative(), resolvedWithoutEscalation: z.number().int().nonnegative(), percentResolvedWithoutEscalation: z.number().finite().min(0).max(100), averageLatencyMs: z.number().finite().nonnegative().nullable(), topTopics: z.array(z.object({ topic: z.string(), count: z.number().int().nonnegative() })).max(5), ragUnansweredQuestions: z.array(z.object({ question: z.string(), intent: z.string(), createdAt: z.string() })) }),
  charts: z.object({ absences30Days: z.array(z.object({ date: reportDateSchema, collaborators: z.number().int().nonnegative() })).length(30), requestsByStatus: z.array(z.object({ status: z.string(), count: z.number().int().nonnegative() })) }),
  executiveSummary: z.object({ text: z.string().min(1), sentences: z.array(z.string().min(1)).min(3).max(5), origin: z.enum(['DEEPSEEK', 'SQL_FALLBACK']) })
});

function partsAt(date, timeZone = TIME_ZONE) {
  const values = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  return Object.fromEntries(values.filter((part) => part.type !== 'literal').map(({ type, value }) => [type, value]));
}

function localDate(date = new Date(), timeZone = TIME_ZONE) {
  const parts = partsAt(date, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function shiftDate(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function localMidnightUtc(isoDate, timeZone = TIME_ZONE) {
  const [year, month, day] = isoDate.split('-').map(Number);
  const utcGuess = Date.UTC(year, month - 1, day);
  const localParts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(utcGuess));
  const partMap = Object.fromEntries(localParts.filter((part) => part.type !== 'literal').map(({ type, value }) => [type, value]));
  const representedUtc = Date.UTC(Number(partMap.year), Number(partMap.month) - 1, Number(partMap.day), Number(partMap.hour), Number(partMap.minute), Number(partMap.second));
  const offset = representedUtc - utcGuess;
  return new Date(utcGuess - offset);
}

function dateParameters(reportDate) {
  const monthStart = `${reportDate.slice(0, 7)}-01`;
  const yearStart = `${reportDate.slice(0, 4)}-01-01`;
  const previousDay = shiftDate(reportDate, -1);
  const dayStart = localMidnightUtc(previousDay);
  const dayEnd = localMidnightUtc(reportDate);
  return { reportDate, monthStart, yearStart, dayStartUtc: dayStart.toISOString().slice(0, 19).replace('T', ' '), dayEndUtc: dayEnd.toISOString().slice(0, 19).replace('T', ' '), previousDay };
}

function numeric(value) { const parsed = Number(value ?? 0); return Number.isFinite(parsed) ? parsed : 0; }
function dateString(value) { return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10); }
function dateTimeString(value) {
  if (value instanceof Date) return value.toISOString();
  const text = String(value);
  return new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(text) ? text : `${text.replace(' ', 'T')}Z`).toISOString();
}
function percentage(numerator, denominator) { return denominator === 0 ? 0 : Number((numerator * 100 / denominator).toFixed(2)); }

function fallbackSummary(metrics) {
  const t = metrics.turnover.yearToDate;
  const sentences = [
    `La dotación activa al cierre del reporte fue de ${metrics.indicators.activeCollaborators} colaboradores.`,
    `Se registraron ${metrics.absences.totalPeople} personas ausentes en la fecha del reporte.`,
    `Quedaron ${metrics.requests.pendingCount} solicitudes pendientes; ${metrics.requests.olderThanThreeDaysCount} superaron tres días sin respuesta.`,
    `Se registraron ${metrics.incapacities.activeCount} incapacidades activas y ${metrics.incapacities.daysMonthToDate} días acumulados en el mes.`,
    `La tasa de rotación acumulada del año fue ${t.ratePercent}% con ${t.distinctExits} salidas observadas.`
  ];
  return { text: sentences.join(' '), sentences, origin: 'SQL_FALLBACK' };
}

function createAnalystAgent({ repository = createReportRepository(), deepSeekService = createDeepSeekService(), keywordModel, prompt = fs.readFileSync(path.join(__dirname, '../prompts/analyst.prompt.md'), 'utf8'), queryPrompt = fs.readFileSync(path.join(__dirname, '../prompts/analyst-query-classifier.prompt.md'), 'utf8'), now = () => new Date(), logger = console } = {}) {
  function getKeywordModel() {
    if (keywordModel && typeof keywordModel.findAll === 'function') return keywordModel;
    if (typeof keywordModel === 'function') return keywordModel();
    return keywordModel || initModels().PalabraClave;
  }

  async function getDashboardKeywords() {
    return getKeywordModel().findAll({
      where: { categoria: 'tema_dashboard', activa: true },
      attributes: ['id', 'palabra', 'tema_asociado'],
      order: [['id', 'ASC']],
      raw: true
    });
  }

  async function classifyReportMetric(question) {
    const response = await deepSeekService.generateStructured({
      messages: [
        { role: 'system', content: queryPrompt },
        { role: 'user', content: JSON.stringify({ question, allowedMetrics: REPORT_METRIC_OPTIONS }) }
      ],
      maxTokens: 60
    }, reportMetricSchema);
    const parsed = reportMetricSchema.parse(response.data);
    return parsed.confidence >= 0.65 && parsed.metric !== 'unknown' ? parsed.metric : null;
  }

  function validateDate(input) {
    const candidate = input || localDate(now());
    const parsed = reportDateSchema.safeParse(candidate);
    if (!parsed.success || new Date(`${candidate}T00:00:00.000Z`).toISOString().slice(0, 10) !== candidate) throw new HttpError(400, 'La fecha del reporte debe ser una fecha válida con formato AAAA-MM-DD.');
    return candidate;
  }

  async function createSummary(metrics) {
    const candidates = [
      ['active', `La dotación activa al cierre del reporte fue de ${metrics.indicators.activeCollaborators} colaboradores.`],
      ['absences', `Se registraron ${metrics.absences.totalPeople} personas ausentes en la fecha del reporte.`],
      ['requests', `Quedaron ${metrics.requests.pendingCount} solicitudes pendientes; ${metrics.requests.olderThanThreeDaysCount} superaron tres días sin respuesta.`],
      ['incapacities', `Se registraron ${metrics.incapacities.activeCount} incapacidades activas y ${metrics.incapacities.daysMonthToDate} días acumulados en el mes.`],
      ['turnover', `La tasa de rotación acumulada del año fue ${metrics.turnover.yearToDate.ratePercent}% con ${metrics.turnover.yearToDate.distinctExits} salidas observadas.`],
      ['vacations', `Se identificaron ${metrics.vacations.over20DaysCount} colaboradores con más de 20 días de vacaciones disponibles.`],
      ['chatbot', `El chatbot recibió ${metrics.chatbot.totalQueries} consultas el día previo y resolvió ${metrics.chatbot.percentResolvedWithoutEscalation}% sin escalamiento.`]
    ];
    const ids = candidates.map(([id]) => id);
    const selectionSchema = z.object({ sentences: z.array(z.enum(ids)).min(3).max(5) });
    const result = await deepSeekService.generateStructured({
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: JSON.stringify({ datosAgregados: metrics.indicators, hechosPermitidos: candidates.map(([id, sentence]) => ({ id, fraseExacta: sentence })) }) }
      ], maxTokens: 150
    }, selectionSchema);
    const selected = selectionSchema.parse(result.data).sentences;
    if (new Set(selected).size !== selected.length) throw new Error('DeepSeek repitió hechos en el resumen.');
    const byId = new Map(candidates);
    const sentences = selected.map((id) => byId.get(id));
    return { text: sentences.join(' '), sentences, origin: 'DEEPSEEK' };
  }

  function buildReport(raw, reportDate, previousDay) {
    const absentByType = raw.absences.map((row) => ({ type: row.tipo, department: row.departamento, collaborators: numeric(row.colaboradores) }));
    const absentTotal = absentByType.reduce((sum, item) => sum + item.collaborators, 0);
    const pendingRows = raw.pendingRows.map((row) => ({
      id: String(row.id), code: row.codigo, name: `${row.nombres} ${row.apellidos}`.trim(), department: row.departamento,
      type: row.tipo, requestedDays: numeric(row.dias_solicitados), startDate: dateString(row.fecha_inicio), endDate: dateString(row.fecha_fin),
      createdAt: dateTimeString(row.creado_en), daysWithoutResponse: Math.max(0, numeric(row.dias_sin_respuesta))
    }));
    const activeIncap = raw.activeIncapacities[0] || {};
    const monthMoves = raw.movements[0] || {};
    const turnoverRaw = raw.turnover[0] || {};
    const openingHeadcount = numeric(turnoverRaw.dotacionInicial);
    const currentHeadcount = numeric(turnoverRaw.dotacionActual);
    const distinctExits = numeric(turnoverRaw.salidasAcumuladas);
    const vacations = raw.vacations.map((row) => ({ code: row.codigo, name: `${row.nombres} ${row.apellidos}`.trim(), department: row.departamento, availableDays: numeric(row.dias_disponibles) }));
    const chatRaw = raw.chat[0] || {};
    const totalQueries = numeric(chatRaw.total);
    const resolved = numeric(chatRaw.resueltasSinEscalamiento);
    const trendMap = new Map(raw.trend.map((row) => [dateString(row.fecha), numeric(row.colaboradores)]));
    const trend30Days = Array.from({ length: 30 }, (_, index) => {
      const date = shiftDate(reportDate, index - 29);
      return { date, collaborators: trendMap.get(date) || 0 };
    });
    const statusDistribution = raw.statuses.map((row) => ({ status: row.estado, count: numeric(row.total) }));
    const ratePercent = percentage(distinctExits, (openingHeadcount + currentHeadcount) / 2);
    const metrics = {
      reportDate,
      indicators: {
        activeCollaborators: numeric(raw.active[0]?.total), absentCollaboratorsToday: absentTotal,
        pendingRequests: numeric(raw.pendingCount[0]?.total), activeIncapacities: numeric(activeIncap.total), vacationBalancesOver20: vacations.length
      },
      absences: { byTypeDepartment: absentByType, totalPeople: absentTotal, trend30Days },
      requests: { pendingCount: numeric(raw.pendingCount[0]?.total), olderThanThreeDaysCount: numeric(raw.pendingOlder[0]?.total), pendingRows, byStatus: statusDistribution },
      incapacities: { activeCount: numeric(activeIncap.total), activeCollaborators: numeric(activeIncap.colaboradores), daysMonthToDate: numeric(raw.incapacityDays[0]?.total) },
      turnover: { month: { hires: numeric(monthMoves.ingresos), exits: numeric(monthMoves.salidas) }, yearToDate: { openingHeadcount, currentHeadcount, distinctExits, ratePercent } },
      vacations: { over20DaysCount: vacations.length, collaborators: vacations },
      chatbot: {
        previousDay, totalQueries, resolvedWithoutEscalation: resolved,
        percentResolvedWithoutEscalation: percentage(resolved, totalQueries),
        averageLatencyMs: chatRaw.latenciaPromedio === null || chatRaw.latenciaPromedio === undefined ? null : Number(Number(chatRaw.latenciaPromedio).toFixed(2)),
        topTopics: raw.topics.map((row) => ({ topic: row.tema, count: numeric(row.total) })).slice(0, 5),
        ragUnansweredQuestions: raw.unanswered.map((row) => ({ question: row.pregunta, intent: row.intencion, createdAt: dateTimeString(row.creado_en) }))
      },
      charts: { absences30Days: trend30Days, requestsByStatus: statusDistribution },
      executiveSummary: { text: 'Pendiente', sentences: ['Pendiente', 'Pendiente', 'Pendiente'], origin: 'SQL_FALLBACK' }
    };
    return reportSchema.parse(metrics);
  }

  async function generateDailyReport(input = {}) {
    const reportDate = validateDate(input.date);
    const stored = await repository.byDate(reportDate);
    if (stored) return { report: stored, created: false, reused: true };
    const params = dateParameters(reportDate);
    const dashboardKeywords = await getDashboardKeywords();
    const raw = await repository.collectMetrics(params, { dashboardKeywords });
    let report = buildReport(raw, reportDate, params.previousDay);
    try {
      report.executiveSummary = await createSummary(report);
    } catch (error) {
      logger.warn?.({ agent: AGENT_NAME, operation: 'executive-summary', code: error.code || error.name });
      report.executiveSummary = fallbackSummary(report);
    }
    report = reportSchema.parse(report);
    const saved = await repository.saveReport(report);
    return { report: saved, created: !saved.updated, reused: false };
  }

  async function answerQuestion({ question, role }) {
    if (role !== 'RRHH') throw new HttpError(403, 'Acceso denegado.');
    if (typeof question !== 'string' || !question.trim()) throw new HttpError(400, 'La pregunta de reporte no es válida.');
    const report = await repository.latest();
    if (!report) return { answer: 'Todavía no hay un reporte diario almacenado. Puede generarse desde la sección administrativa de reportes.', resolved: false, escalationSuggested: false, escalated: false, citations: [], agentsUsed: [AGENT_NAME] };
    let metric = null;
    try { metric = await classifyReportMetric(question); }
    catch (error) { logger.warn?.({ agent: AGENT_NAME, operation: 'question-classification', code: error.code || error.name }); }
    let answer;
    if (metric === 'summary') answer = report.executiveSummary.text;
    else if (metric === 'activeCollaborators') answer = `Colaboradores activos al ${report.reportDate}: ${report.indicators.activeCollaborators}.`;
    else if (metric === 'absences') answer = `Personas ausentes al ${report.reportDate}: ${report.absences.totalPeople}. Detalle: ${report.absences.byTypeDepartment.map((item) => `${item.type} en ${item.department}: ${item.collaborators}`).join('; ') || 'sin ausencias registradas'}.`;
    else if (metric === 'absenceTrend') answer = `Tendencia de personas ausentes durante los 30 días hasta ${report.reportDate}: ${report.absences.trend30Days.map((item) => `${item.date}: ${item.collaborators}`).join('; ')}.`;
    else if (metric === 'requestStatuses') answer = `Solicitudes por estado al ${report.reportDate}: ${report.requests.byStatus.map((item) => `${item.status}: ${item.count}`).join('; ') || 'sin solicitudes registradas'}.`;
    else if (metric === 'turnover') answer = `Tasa de rotación acumulada del año al ${report.reportDate}: ${report.turnover.yearToDate.ratePercent}%. Se calcula como salidas distintas del año divididas entre la dotación promedio inicial y actual.`;
    else if (metric === 'incapacities') answer = `Incapacidades activas al ${report.reportDate}: ${report.incapacities.activeCount} registros de ${report.incapacities.activeCollaborators} colaboradores; días únicos acumulados en el mes: ${report.incapacities.daysMonthToDate}.`;
    else if (metric === 'vacations') answer = `Colaboradores activos con más de 20 días disponibles al ${report.reportDate}: ${report.vacations.over20DaysCount}.`;
    else if (metric === 'ragUnanswered') answer = `Preguntas de políticas sin evidencia RAG el ${report.chatbot.previousDay}: ${report.chatbot.ragUnansweredQuestions.map((item) => item.question).join(' | ') || 'ninguna registrada'}.`;
    else if (metric === 'chatbot') answer = `Consultas al chatbot el ${report.chatbot.previousDay}: ${report.chatbot.totalQueries}; resueltas sin escalamiento: ${report.chatbot.percentResolvedWithoutEscalation}%; latencia promedio: ${report.chatbot.averageLatencyMs ?? 'sin mediciones'} ms. Temas principales: ${report.chatbot.topTopics.map((item) => `${item.topic} (${item.count})`).join(', ') || 'sin consultas'}.`;
    else if (metric === 'movements') answer = `Movimientos del mes hasta ${report.reportDate}: ${report.turnover.month.hires} ingresos y ${report.turnover.month.exits} salidas.`;
    else if (metric === 'pendingRequests') answer = `Solicitudes pendientes al ${report.reportDate}: ${report.requests.pendingCount}; con más de tres días calendario sin respuesta: ${report.requests.olderThanThreeDaysCount}.`;
    else answer = 'No pude identificar el indicador del reporte con suficiente claridad. ¿Puedes precisar qué dato necesitas consultar?';
    return {
      answer: metric ? `Reporte diario almacenado del ${report.reportDate}. ${answer}` : answer,
      resolved: Boolean(metric), escalationSuggested: false, escalated: false, citations: [], agentsUsed: [AGENT_NAME],
      source: 'MySQL: reportes_diarios', reportDate: report.reportDate
    };
  }

  return {
    generateDailyReport,
    latest: () => repository.latest(),
    history: (limit) => repository.history(limit),
    byDate: (date) => repository.byDate(validateDate(date)),
    answerQuestion
  };
}

const defaultAgent = createAnalystAgent();
module.exports = { TIME_ZONE, AGENT_NAME, REPORT_METRIC_IDS, reportMetricSchema, reportSchema, localDate, localMidnightUtc, dateParameters, fallbackSummary, createAnalystAgent, ...defaultAgent };
