'use strict';

const { Op } = require('sequelize');
const { randomUUID } = require('node:crypto');
const { getConnection, getReadConnection } = require('../config/database');
const { initModels } = require('../models');

function plain(record) { return record?.get ? record.get({ plain: true }) : record; }
function isoDate(value) { return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10); }
function dateTime(value) { return value instanceof Date ? value : new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(String(value)) ? value : `${String(value).replace(' ', 'T')}Z`); }
function utcDaysBetween(start, end) {
  const days = [];
  const cursor = new Date(`${start}T00:00:00.000Z`);
  const last = new Date(`${end}T00:00:00.000Z`);
  while (cursor <= last) { days.push(cursor.toISOString().slice(0, 10)); cursor.setUTCDate(cursor.getUTCDate() + 1); }
  return days;
}
function dayDifference(start, end) {
  return Math.max(0, Math.floor((Date.parse(`${end}T00:00:00.000Z`) - Date.parse(`${start}T00:00:00.000Z`)) / 86400000));
}
function groupBy(rows, keyFn) {
  const map = new Map();
  for (const row of rows) { const key = keyFn(row); map.set(key, [...(map.get(key) || []), row]); }
  return map;
}

function createReportRepository({ readConnectionFactory = getReadConnection, writeConnectionFactory = getConnection, modelsFactory = initModels, now = () => new Date() } = {}) {
  async function collectMetrics({ reportDate, monthStart, yearStart, dayStartUtc, dayEndUtc }) {
    const sequelize = readConnectionFactory();
    const m = modelsFactory(sequelize);
    const trendDate = new Date(`${reportDate}T00:00:00.000Z`);
    trendDate.setUTCDate(trendDate.getUTCDate() - 29);
    const absenceStart = [monthStart, trendDate.toISOString().slice(0, 10)].sort()[0];
    const [collaboratorRecords, requestRecords, incapacityRecords, movementRecords, vacationRecords, chatRecords] = await Promise.all([
      m.Colaborador.findAll({ attributes: ['id', 'codigo', 'nombres', 'apellidos', 'estado', 'fecha_ingreso', 'fecha_salida', 'departamento_id'], include: [{ model: m.Departamento, attributes: ['nombre'], required: true }], raw: true, nest: true }),
      m.Solicitud.findAll({ attributes: ['id', 'colaborador_id', 'tipo', 'fecha_inicio', 'fecha_fin', 'dias_solicitados', 'estado', 'creado_en'], raw: true }),
      m.Incapacidad.findAll({ where: { fecha_inicio: { [Op.lte]: reportDate }, fecha_fin: { [Op.gte]: absenceStart } }, attributes: ['colaborador_id', 'fecha_inicio', 'fecha_fin', 'estado'], raw: true }),
      m.MovimientoPersonal.findAll({ where: { fecha_efectiva: { [Op.between]: [yearStart, reportDate] } }, attributes: ['colaborador_id', 'tipo', 'fecha_efectiva'], raw: true }),
      m.SaldoVacaciones.findAll({ attributes: ['colaborador_id', 'dias_disponibles'], raw: true }),
      m.ConsultaChat.findAll({ where: { creado_en: { [Op.gte]: dayStartUtc, [Op.lt]: dayEndUtc } }, attributes: ['resolucion', 'escalamiento_realizado', 'latencia_ms', 'tema', 'pregunta', 'intencion', 'creado_en'], raw: true })
    ]);
    const collaborators = collaboratorRecords.map(plain);
    const requests = requestRecords.map(plain);
    const incapacity = incapacityRecords.map(plain);
    const movements = movementRecords.map(plain);
    const balances = vacationRecords.map(plain);
    const chats = chatRecords.map(plain);
    const collabById = new Map(collaborators.map((row) => [row.id, row]));

    const active = collaborators.filter((row) => row.estado === 'ACTIVO');
    const pending = requests.filter((row) => row.estado === 'PENDIENTE');
    const pendingRows = pending.map((row) => {
      const employee = collabById.get(row.colaborador_id) || {};
      const createdDate = isoDate(row.creado_en);
      return { id: row.id, codigo: employee.codigo || '', nombres: employee.nombres || '', apellidos: employee.apellidos || '', departamento: employee.Departamento?.nombre || '', tipo: row.tipo, dias_solicitados: row.dias_solicitados, fecha_inicio: row.fecha_inicio, fecha_fin: row.fecha_fin, creado_en: row.creado_en, dias_sin_respuesta: dayDifference(createdDate, reportDate) };
    }).sort((a, b) => dateTime(a.creado_en) - dateTime(b.creado_en) || String(a.id).localeCompare(String(b.id)));

    const currentCases = incapacity.filter((row) => ['REGISTRADA', 'EN_REVISION'].includes(row.estado) && isoDate(row.fecha_inicio) <= reportDate && isoDate(row.fecha_fin) >= reportDate && collabById.get(row.colaborador_id)?.estado === 'ACTIVO');
    const absenceCandidates = [];
    for (const row of currentCases) absenceCandidates.push({ id: row.colaborador_id, type: 'INCAPACIDAD', department: collabById.get(row.colaborador_id)?.Departamento?.nombre || '', priority: 1 });
    for (const row of requests.filter((item) => item.estado === 'APROBADA' && isoDate(item.fecha_inicio) <= reportDate && isoDate(item.fecha_fin) >= reportDate)) {
      const employee = collabById.get(row.colaborador_id);
      if (employee?.estado === 'ACTIVO') absenceCandidates.push({ id: row.colaborador_id, type: row.tipo, department: employee.Departamento?.nombre || '', priority: 2 });
    }
    const absentByPerson = new Map();
    for (const candidate of absenceCandidates) {
      const current = absentByPerson.get(candidate.id);
      if (!current || candidate.priority < current.priority || (candidate.priority === current.priority && candidate.type.localeCompare(current.type) < 0)) absentByPerson.set(candidate.id, candidate);
    }
    const absenceGroups = [...groupBy([...absentByPerson.values()], (row) => `${row.type}\u0000${row.department}`).entries()]
      .map(([key, rows]) => { const [tipo, departamento] = key.split('\u0000'); return { tipo, departamento, colaboradores: rows.length }; })
      .sort((a, b) => a.tipo.localeCompare(b.tipo) || a.departamento.localeCompare(b.departamento));

    const monthIncapacityDays = new Set();
    for (const row of incapacity) for (const date of utcDaysBetween([monthStart, isoDate(row.fecha_inicio)].sort().at(-1), [reportDate, isoDate(row.fecha_fin)].sort()[0])) {
      if (date >= monthStart && date <= reportDate) monthIncapacityDays.add(`${row.colaborador_id}\u0000${date}`);
    }
    const monthlyMovements = movements.filter((row) => isoDate(row.fecha_efectiva) >= monthStart && isoDate(row.fecha_efectiva) <= reportDate);
    const uniqueCount = (rows, type) => new Set(rows.filter((row) => row.tipo === type).map((row) => row.colaborador_id)).size;
    const openingHeadcount = collaborators.filter((row) => isoDate(row.fecha_ingreso) <= yearStart && (!row.fecha_salida || isoDate(row.fecha_salida) > yearStart)).length;
    const currentHeadcount = collaborators.filter((row) => isoDate(row.fecha_ingreso) <= reportDate && (!row.fecha_salida || isoDate(row.fecha_salida) > reportDate)).length;
    const distinctExits = new Set(movements.filter((row) => row.tipo === 'SALIDA' && isoDate(row.fecha_efectiva) >= yearStart && isoDate(row.fecha_efectiva) <= reportDate).map((row) => row.colaborador_id)).size;

    const balancesByCollaborator = new Map();
    for (const balance of balances) balancesByCollaborator.set(balance.colaborador_id, (balancesByCollaborator.get(balance.colaborador_id) || 0) + Number(balance.dias_disponibles || 0));
    const vacations = active.filter((employee) => (balancesByCollaborator.get(employee.id) || 0) > 20).map((employee) => ({ id: employee.id, codigo: employee.codigo, nombres: employee.nombres, apellidos: employee.apellidos, departamento: employee.Departamento?.nombre || '', dias_disponibles: balancesByCollaborator.get(employee.id) })).sort((a, b) => b.dias_disponibles - a.dias_disponibles || a.codigo.localeCompare(b.codigo));

    const topicCounts = new Map();
    for (const row of chats) { const topic = String(row.tema || '').trim() || 'SIN_CLASIFICAR'; topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1); }
    const latencies = chats.map((row) => row.latencia_ms).filter((value) => value !== null && value !== undefined).map(Number);
    const chatsResolved = chats.filter((row) => row.resolucion === 'RESPONDIDA' && ![true, 1, '1'].includes(row.escalamiento_realizado)).length;
    const unanswered = chats.filter((row) => row.resolucion === 'SIN_EVIDENCIA' && ['POLITICA', 'MIXTA'].includes(row.intencion)).sort((a, b) => dateTime(a.creado_en) - dateTime(b.creado_en)).map((row) => ({ pregunta: row.pregunta, intencion: row.intencion, creado_en: row.creado_en }));

    const trendCounts = new Map();
    for (const row of incapacity.filter((item) => ['REGISTRADA', 'EN_REVISION', 'CERRADA'].includes(item.estado))) {
      const start = [isoDate(row.fecha_inicio), trendDate.toISOString().slice(0, 10)].sort().at(-1);
      const end = [isoDate(row.fecha_fin), reportDate].sort()[0];
      if (start <= end) for (const day of utcDaysBetween(start, end)) trendCounts.set(`${row.colaborador_id}\u0000${day}`, day);
    }
    for (const row of requests.filter((item) => item.estado === 'APROBADA')) {
      const start = [isoDate(row.fecha_inicio), trendDate.toISOString().slice(0, 10)].sort().at(-1);
      const end = [isoDate(row.fecha_fin), reportDate].sort()[0];
      if (start <= end) for (const day of utcDaysBetween(start, end)) trendCounts.set(`${row.colaborador_id}\u0000${day}`, day);
    }
    const trendByDay = new Map(utcDaysBetween(trendDate.toISOString().slice(0, 10), reportDate).map((day) => [day, 0]));
    for (const key of trendCounts.keys()) { const day = key.split('\u0000')[1]; trendByDay.set(day, (trendByDay.get(day) || 0) + 1); }
    const statuses = [...groupBy(requests, (row) => row.estado).entries()].map(([estado, rows]) => ({ estado, total: rows.length })).sort((a, b) => a.estado.localeCompare(b.estado));

    return {
      active: [{ total: active.length }], absences: absenceGroups,
      pendingCount: [{ total: pending.length }], pendingOlder: [{ total: pending.filter((row) => dayDifference(isoDate(row.creado_en), reportDate) > 3).length }], pendingRows,
      activeIncapacities: [{ total: currentCases.length, colaboradores: new Set(currentCases.map((row) => row.colaborador_id)).size }], incapacityDays: [{ total: monthIncapacityDays.size }],
      movements: [{ ingresos: uniqueCount(monthlyMovements, 'INGRESO'), salidas: uniqueCount(monthlyMovements, 'SALIDA') }],
      turnover: [{ dotacionInicial: openingHeadcount, dotacionActual: currentHeadcount, salidasAcumuladas: distinctExits }],
      vacations, chat: [{ total: chats.length, resueltasSinEscalamiento: chatsResolved, latenciaPromedio: latencies.length ? latencies.reduce((sum, value) => sum + value, 0) / latencies.length : null }],
      topics: [...topicCounts.entries()].map(([tema, total]) => ({ tema, total })).sort((a, b) => b.total - a.total || a.tema.localeCompare(b.tema)).slice(0, 5),
      unanswered, trend: [...trendByDay.entries()].map(([fecha, colaboradores]) => ({ fecha, colaboradores })), statuses
    };
  }

  function reportModel(connection = writeConnectionFactory()) { return modelsFactory(connection).ReporteDiario; }
  async function saveReport(report) {
    const connection = writeConnectionFactory();
    const Model = reportModel(connection);
    try {
      return await connection.transaction(async (transaction) => {
        const current = await Model.findOne({ where: { fecha: report.reportDate }, transaction, lock: transaction.LOCK.UPDATE });
        if (current) { const metrics = typeof current.metricas === 'string' ? JSON.parse(current.metricas) : current.metricas; return { ...metrics, storedAt: current.creado_en, updated: true }; }
        await Model.create({ id: randomUUID(), fecha: report.reportDate, metricas: report, creado_en: now() }, { transaction });
        return { ...report, storedAt: now().toISOString(), updated: false };
      });
    } catch (error) {
      if (!(error.name === 'SequelizeUniqueConstraintError' || error.original?.code === 'ER_DUP_ENTRY')) throw error;
      const existing = await Model.findOne({ where: { fecha: report.reportDate }, raw: true });
      if (!existing) throw error;
      const metrics = typeof existing.metricas === 'string' ? JSON.parse(existing.metricas) : existing.metricas;
      return { ...metrics, storedAt: existing.creado_en, updated: true };
    }
  }
  async function readStoredReport(where, options = {}) {
    const record = await reportModel(readConnectionFactory()).findOne({ where, raw: true, ...options });
    if (!record) return null;
    const metrics = typeof record.metricas === 'string' ? JSON.parse(record.metricas) : record.metricas;
    return { ...metrics, storedAt: record.creado_en };
  }
  async function latest() { return readStoredReport({}, { order: [['fecha', 'DESC']] }); }
  async function byDate(date) { return readStoredReport({ fecha: date }); }
  async function history(limit = 30) {
    const rows = await reportModel(readConnectionFactory()).findAll({ attributes: ['fecha', 'metricas', 'creado_en'], order: [['fecha', 'DESC']], limit, raw: true });
    return rows.map((record) => ({ ...(typeof record.metricas === 'string' ? JSON.parse(record.metricas) : record.metricas), storedAt: record.creado_en }));
  }
  async function claimExecution({ key, task }) {
    const connection = writeConnectionFactory();
    const Model = modelsFactory(connection).TrabajoProgramado;
    try {
      return await connection.transaction(async (transaction) => {
        const row = await Model.findOne({ where: { clave_ejecucion: key }, transaction, lock: transaction.LOCK.UPDATE });
        const staleBefore = new Date(now().getTime() - 2 * 60 * 60 * 1000);
        if (row?.estado === 'COMPLETADO') return false;
        if (row?.estado === 'EN_PROCESO' && new Date(row.inicio_en) > staleBefore) return false;
        if (row) await row.update({ tarea: task, estado: 'EN_PROCESO', inicio_en: now(), finalizo_en: null, error_codigo: null }, { transaction });
        else await Model.create({ id: randomUUID(), clave_ejecucion: key, tarea: task, estado: 'EN_PROCESO', inicio_en: now() }, { transaction });
        return true;
      });
    } catch (error) {
      if (error.name === 'SequelizeUniqueConstraintError' || error.original?.code === 'ER_DUP_ENTRY') return false;
      throw error;
    }
  }
  async function finishExecution(key, { status, result = null, errorCode = null }) {
    const Model = modelsFactory(writeConnectionFactory()).TrabajoProgramado;
    await Model.update({ estado: status, finalizo_en: now(), resultado: result, error_codigo: errorCode }, { where: { clave_ejecucion: key } });
  }

  return { collectMetrics, saveReport, latest, byDate, history, claimExecution, finishExecution };
}

module.exports = { createReportRepository };
