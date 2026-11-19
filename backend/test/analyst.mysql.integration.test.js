'use strict';

require('dotenv').config();
const test = require('node:test');
const assert = require('node:assert/strict');
const { Op } = require('sequelize');
const { getReadConnection, closePool } = require('../src/config/database');
const { initModels } = require('../src/models');
const { matchingKeyword } = require('../src/utils/keywordMatcher');
const { createReportRepository } = require('../src/repositories/reportRepository');
const { createAnalystAgent, localDate, dateParameters } = require('../src/services/analyst.agent');

const canRun = Boolean(process.env.DB_READ_USER && process.env.DB_READ_PASSWORD);
const dateOnly = (value) => value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
function daysBetween(start, end) {
  const days = [];
  const cursor = new Date(`${start}T00:00:00.000Z`);
  const last = new Date(`${end}T00:00:00.000Z`);
  while (cursor <= last) { days.push(cursor.toISOString().slice(0, 10)); cursor.setUTCDate(cursor.getUTCDate() + 1); }
  return days;
}
function dayDifference(start, end) {
  return Math.max(0, Math.floor((Date.parse(`${end}T00:00:00.000Z`) - Date.parse(`${start}T00:00:00.000Z`)) / 86400000));
}

test('compara los indicadores diarios con cálculos independientes sobre modelos Sequelize de solo lectura', {
  skip: canRun ? false : 'Faltan DB_READ_USER y DB_READ_PASSWORD; no se usa la cuenta de escritura para esta prueba.'
}, async () => {
  const readDb = getReadConnection();
  const models = initModels(readDb);
  const sourceRepository = createReportRepository();
  const repository = {
    byDate: async () => null,
    collectMetrics: sourceRepository.collectMetrics,
    saveReport: async (report) => report,
    latest: async () => null,
    history: async () => []
  };
  const agent = createAnalystAgent({
    repository,
    keywordModel: models.PalabraClave,
    deepSeekService: { generateStructured: async () => ({ data: { sentences: ['active', 'absences', 'requests'] } }) },
    logger: { warn() {} }
  });

  try {
    const reportDate = localDate();
    const periods = dateParameters(reportDate);
    const { report } = await agent.generateDailyReport({ date: reportDate });
    const trendDate = new Date(`${reportDate}T00:00:00.000Z`);
    trendDate.setUTCDate(trendDate.getUTCDate() - 29);
    const trendStartDate = trendDate.toISOString().slice(0, 10);
    const absenceStart = [periods.monthStart, trendStartDate].sort()[0];
    const [collaboratorRecords, requestRecords, incapacityRecords, movementRecords, balanceRecords, chatRecords, dashboardKeywords] = await Promise.all([
      models.Colaborador.findAll({ attributes: ['id', 'codigo', 'nombres', 'apellidos', 'estado', 'fecha_ingreso', 'fecha_salida', 'departamento_id'], include: [{ model: models.Departamento, attributes: ['nombre'], required: true }] }),
      models.Solicitud.findAll({ attributes: ['id', 'colaborador_id', 'tipo', 'fecha_inicio', 'fecha_fin', 'dias_solicitados', 'estado', 'creado_en'] }),
      models.Incapacidad.findAll({ where: { fecha_inicio: { [Op.lte]: reportDate }, fecha_fin: { [Op.gte]: absenceStart } }, attributes: ['colaborador_id', 'fecha_inicio', 'fecha_fin', 'estado'] }),
      models.MovimientoPersonal.findAll({ where: { fecha_efectiva: { [Op.between]: [periods.yearStart, reportDate] } }, attributes: ['colaborador_id', 'tipo', 'fecha_efectiva'] }),
      models.SaldoVacaciones.findAll({ attributes: ['colaborador_id', 'dias_disponibles'] }),
      models.ConsultaChat.findAll({ where: { creado_en: { [Op.gte]: periods.dayStartUtc, [Op.lt]: periods.dayEndUtc } }, attributes: ['resolucion', 'escalamiento_realizado', 'latencia_ms', 'pregunta', 'intencion', 'creado_en'] }),
      models.PalabraClave.findAll({ where: { categoria: 'tema_dashboard', activa: true }, attributes: ['id', 'palabra', 'tema_asociado'], order: [['id', 'ASC']], raw: true })
    ]);
    const collaborators = collaboratorRecords.map((row) => row.get({ plain: true }));
    const requests = requestRecords.map((row) => row.get({ plain: true }));
    const incapacities = incapacityRecords.map((row) => row.get({ plain: true }));
    const movements = movementRecords.map((row) => row.get({ plain: true }));
    const balances = balanceRecords.map((row) => row.get({ plain: true }));
    const chats = chatRecords.map((row) => row.get({ plain: true }));
    const byCollaborator = new Map(collaborators.map((row) => [row.id, row]));
    const active = collaborators.filter((row) => row.estado === 'ACTIVO');
    const pending = requests.filter((row) => row.estado === 'PENDIENTE');

    const currentCases = incapacities.filter((row) => ['REGISTRADA', 'EN_REVISION'].includes(row.estado)
      && dateOnly(row.fecha_inicio) <= reportDate && dateOnly(row.fecha_fin) >= reportDate
      && byCollaborator.get(row.colaborador_id)?.estado === 'ACTIVO');
    const absences = new Map();
    for (const row of currentCases) absences.set(row.colaborador_id, {
      id: row.colaborador_id, type: 'INCAPACIDAD', department: byCollaborator.get(row.colaborador_id)?.Departamento?.nombre || '', priority: 1
    });
    for (const row of requests.filter((item) => item.estado === 'APROBADA' && dateOnly(item.fecha_inicio) <= reportDate && dateOnly(item.fecha_fin) >= reportDate)) {
      const collaborator = byCollaborator.get(row.colaborador_id);
      if (collaborator?.estado !== 'ACTIVO') continue;
      const current = absences.get(row.colaborador_id);
      const candidate = { id: row.colaborador_id, type: row.tipo, department: collaborator.Departamento?.nombre || '', priority: 2 };
      if (!current || candidate.priority < current.priority || (candidate.priority === current.priority && candidate.type.localeCompare(current.type) < 0)) absences.set(row.colaborador_id, candidate);
    }
    const absenceGroups = new Map();
    for (const item of absences.values()) {
      const key = `${item.type}\u0000${item.department}`;
      absenceGroups.set(key, (absenceGroups.get(key) || 0) + 1);
    }
    const expectedAbsenceGroups = [...absenceGroups.entries()].map(([key, collaboratorsCount]) => {
      const [type, department] = key.split('\u0000');
      return [type, department, collaboratorsCount];
    }).sort((left, right) => left[0].localeCompare(right[0]) || left[1].localeCompare(right[1]));

    const daysInMonth = new Set();
    for (const row of incapacities) {
      const start = [periods.monthStart, dateOnly(row.fecha_inicio)].sort().at(-1);
      const end = [reportDate, dateOnly(row.fecha_fin)].sort()[0];
      if (start <= end) for (const day of daysBetween(start, end)) if (day >= periods.monthStart && day <= reportDate) daysInMonth.add(`${row.colaborador_id}\u0000${day}`);
    }

    const monthMovements = movements.filter((row) => dateOnly(row.fecha_efectiva) >= periods.monthStart && dateOnly(row.fecha_efectiva) <= reportDate);
    const uniqueMovementCount = (rows, type) => new Set(rows.filter((row) => row.tipo === type).map((row) => row.colaborador_id)).size;
    const openingHeadcount = collaborators.filter((row) => dateOnly(row.fecha_ingreso) <= periods.yearStart && (!row.fecha_salida || dateOnly(row.fecha_salida) > periods.yearStart)).length;
    const currentHeadcount = collaborators.filter((row) => dateOnly(row.fecha_ingreso) <= reportDate && (!row.fecha_salida || dateOnly(row.fecha_salida) > reportDate)).length;
    const exitsYtd = new Set(movements.filter((row) => row.tipo === 'SALIDA' && dateOnly(row.fecha_efectiva) >= periods.yearStart && dateOnly(row.fecha_efectiva) <= reportDate).map((row) => row.colaborador_id)).size;
    const vacationByCollaborator = new Map();
    for (const row of balances) vacationByCollaborator.set(row.colaborador_id, (vacationByCollaborator.get(row.colaborador_id) || 0) + Number(row.dias_disponibles || 0));
    const vacationCount = active.filter((row) => (vacationByCollaborator.get(row.id) || 0) > 20).length;

    const currentChatStart = periods.previousDay;
    const resolved = chats.filter((row) => row.resolucion === 'RESPONDIDA' && ![true, 1, '1'].includes(row.escalamiento_realizado)).length;
    const latencies = chats.map((row) => row.latencia_ms).filter((value) => value !== null && value !== undefined).map(Number);
    const topics = new Map();
    for (const row of chats) {
      const matched = matchingKeyword(row.pregunta, dashboardKeywords);
      if (matched?.tema_asociado) topics.set(matched.tema_asociado, (topics.get(matched.tema_asociado) || 0) + 1);
    }
    const expectedTopics = [...topics.entries()].map(([topic, count]) => [topic, count]).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])).slice(0, 5);
    const unansweredCount = chats.filter((row) => row.resolucion === 'SIN_EVIDENCIA' && ['POLITICA', 'MIXTA'].includes(row.intencion)).length;

    const statusCounts = new Map();
    for (const row of requests) statusCounts.set(row.estado, (statusCounts.get(row.estado) || 0) + 1);
    const statusOrder = ['PENDIENTE', 'APROBADA', 'RECHAZADA', 'CANCELADA'];
    const expectedStatuses = [...statusCounts.entries()].map(([status, count]) => [status, count]).sort((left, right) => statusOrder.indexOf(left[0]) - statusOrder.indexOf(right[0]));

    const trendPeopleByDay = new Map(daysBetween(trendStartDate, reportDate).map((day) => [day, new Set()]));
    const includeRange = (collaboratorId, startValue, endValue) => {
      const start = [dateOnly(startValue), trendStartDate].sort().at(-1);
      const end = [dateOnly(endValue), reportDate].sort()[0];
      if (start <= end) for (const day of daysBetween(start, end)) trendPeopleByDay.get(day)?.add(collaboratorId);
    };
    for (const row of incapacities.filter((item) => ['REGISTRADA', 'EN_REVISION', 'CERRADA'].includes(item.estado))) includeRange(row.colaborador_id, row.fecha_inicio, row.fecha_fin);
    for (const row of requests.filter((item) => item.estado === 'APROBADA')) includeRange(row.colaborador_id, row.fecha_inicio, row.fecha_fin);
    const expectedTrend = [...trendPeopleByDay.entries()].map(([day, people]) => [day, people.size]);

    const olderPending = pending.filter((row) => dayDifference(dateOnly(row.creado_en), reportDate) > 3).length;
    const incapsActivePeople = new Set(currentCases.map((row) => row.colaborador_id)).size;
    const expectedRate = openingHeadcount + currentHeadcount === 0 ? 0 : Number((exitsYtd * 100 / ((openingHeadcount + currentHeadcount) / 2)).toFixed(2));
    assert.equal(report.indicators.activeCollaborators, active.length);
    assert.equal(report.absences.totalPeople, absences.size);
    assert.deepEqual(report.absences.byTypeDepartment.map((row) => [row.type, row.department, row.collaborators]), expectedAbsenceGroups);
    assert.equal(report.requests.pendingCount, pending.length);
    assert.equal(report.requests.olderThanThreeDaysCount, olderPending);
    assert.equal(report.incapacities.activeCount, currentCases.length);
    assert.equal(report.incapacities.activeCollaborators, incapsActivePeople);
    assert.equal(report.incapacities.daysMonthToDate, daysInMonth.size);
    assert.deepEqual(report.turnover.month, { hires: uniqueMovementCount(monthMovements, 'INGRESO'), exits: uniqueMovementCount(monthMovements, 'SALIDA') });
    assert.equal(report.turnover.yearToDate.ratePercent, expectedRate);
    assert.equal(report.turnover.yearToDate.openingHeadcount, openingHeadcount);
    assert.equal(report.turnover.yearToDate.currentHeadcount, currentHeadcount);
    assert.equal(report.turnover.yearToDate.distinctExits, exitsYtd);
    assert.equal(report.vacations.over20DaysCount, vacationCount);
    assert.equal(report.chatbot.totalQueries, chats.length);
    assert.equal(report.chatbot.resolvedWithoutEscalation, resolved);
    assert.equal(report.chatbot.percentResolvedWithoutEscalation, chats.length ? Number((resolved * 100 / chats.length).toFixed(2)) : 0);
    assert.equal(report.chatbot.averageLatencyMs, latencies.length ? Number((latencies.reduce((sum, value) => sum + value, 0) / latencies.length).toFixed(2)) : null);
    assert.deepEqual(report.chatbot.topTopics.map((row) => [row.topic, row.count]), expectedTopics);
    assert.equal(report.chatbot.ragUnansweredQuestions.length, unansweredCount);
    assert.deepEqual(report.requests.byStatus.map((row) => [row.status, row.count]), expectedStatuses);
    assert.deepEqual(report.absences.trend30Days.map((row) => [row.date, row.collaborators]), expectedTrend);
    assert.equal(report.chatbot.previousDay, currentChatStart);
  } finally {
    await closePool();
  }
});
