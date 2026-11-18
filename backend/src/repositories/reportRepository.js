'use strict';

const { QueryTypes } = require('sequelize');
const { randomUUID } = require('node:crypto');
const { getConnection, getReadConnection } = require('../config/database');
const { initModels } = require('../models');

const SQL = {
  activeCollaborators: `SELECT COUNT(*) AS total FROM colaboradores WHERE estado = 'ACTIVO'`,
  absences: `SELECT tipo, departamento, COUNT(*) AS colaboradores FROM (
    SELECT clasificada.*, ROW_NUMBER() OVER (PARTITION BY colaborador_id ORDER BY prioridad, tipo) AS posicion
    FROM (
      SELECT i.colaborador_id, 'INCAPACIDAD' AS tipo, d.nombre AS departamento, 1 AS prioridad
      FROM incapacidades i JOIN colaboradores c ON c.id = i.colaborador_id JOIN departamentos d ON d.id = c.departamento_id
      WHERE c.estado = 'ACTIVO' AND i.estado IN ('REGISTRADA','EN_REVISION') AND i.fecha_inicio <= :reportDate AND i.fecha_fin >= :reportDate
      UNION ALL
      SELECT s.colaborador_id, s.tipo, d.nombre AS departamento, 2 AS prioridad
      FROM solicitudes s JOIN colaboradores c ON c.id = s.colaborador_id JOIN departamentos d ON d.id = c.departamento_id
      WHERE c.estado = 'ACTIVO' AND s.estado = 'APROBADA' AND s.fecha_inicio <= :reportDate AND s.fecha_fin >= :reportDate
    ) clasificada
  ) ranked WHERE posicion = 1 GROUP BY tipo, departamento ORDER BY tipo, departamento`,
  pendingCount: `SELECT COUNT(*) AS total FROM solicitudes WHERE estado = 'PENDIENTE'`,
  pendingOlderThanThreeDays: `SELECT COUNT(*) AS total FROM solicitudes WHERE estado = 'PENDIENTE' AND DATEDIFF(:reportDate, DATE(creado_en)) > 3`,
  pendingRows: `SELECT s.id, c.codigo, c.nombres, c.apellidos, d.nombre AS departamento, s.tipo, s.dias_solicitados,
      s.fecha_inicio, s.fecha_fin, s.creado_en, DATEDIFF(:reportDate, DATE(s.creado_en)) AS dias_sin_respuesta
    FROM solicitudes s JOIN colaboradores c ON c.id = s.colaborador_id JOIN departamentos d ON d.id = c.departamento_id
    WHERE s.estado = 'PENDIENTE' ORDER BY s.creado_en ASC, s.id ASC`,
  activeIncapacities: `SELECT COUNT(*) AS total, COUNT(DISTINCT i.colaborador_id) AS colaboradores FROM incapacidades i
    JOIN colaboradores c ON c.id = i.colaborador_id WHERE c.estado = 'ACTIVO' AND i.estado IN ('REGISTRADA','EN_REVISION')
      AND i.fecha_inicio <= :reportDate AND i.fecha_fin >= :reportDate`,
  incapacityDaysMonthToDate: `WITH RECURSIVE calendario(dia) AS (
      SELECT CAST(:monthStart AS DATE) UNION ALL SELECT DATE_ADD(dia, INTERVAL 1 DAY) FROM calendario WHERE dia < CAST(:reportDate AS DATE)
    ), dias AS (
      SELECT DISTINCT i.colaborador_id, calendario.dia FROM calendario JOIN incapacidades i
        ON i.fecha_inicio <= calendario.dia AND i.fecha_fin >= calendario.dia
    ) SELECT COUNT(*) AS total FROM dias`,
  monthlyMovements: `SELECT
      COUNT(DISTINCT CASE WHEN tipo = 'INGRESO' THEN colaborador_id END) AS ingresos,
      COUNT(DISTINCT CASE WHEN tipo = 'SALIDA' THEN colaborador_id END) AS salidas
    FROM movimientos_personal WHERE fecha_efectiva BETWEEN :monthStart AND :reportDate`,
  turnover: `SELECT
      (SELECT COUNT(*) FROM colaboradores WHERE fecha_ingreso <= :yearStart AND (fecha_salida IS NULL OR fecha_salida > :yearStart)) AS dotacionInicial,
      (SELECT COUNT(*) FROM colaboradores WHERE fecha_ingreso <= :reportDate AND (fecha_salida IS NULL OR fecha_salida > :reportDate)) AS dotacionActual,
      (SELECT COUNT(DISTINCT colaborador_id) FROM movimientos_personal WHERE tipo = 'SALIDA' AND fecha_efectiva BETWEEN :yearStart AND :reportDate) AS salidasAcumuladas`,
  vacationsOverTwenty: `SELECT c.id, c.codigo, c.nombres, c.apellidos, d.nombre AS departamento, SUM(v.dias_disponibles) AS dias_disponibles
    FROM colaboradores c JOIN saldos_vacaciones v ON v.colaborador_id = c.id JOIN departamentos d ON d.id = c.departamento_id
    WHERE c.estado = 'ACTIVO' GROUP BY c.id, c.codigo, c.nombres, c.apellidos, d.nombre
    HAVING SUM(v.dias_disponibles) > 20 ORDER BY dias_disponibles DESC, c.codigo ASC`,
  chatbot: `SELECT COUNT(*) AS total,
      SUM(CASE WHEN resolucion = 'RESPONDIDA' AND COALESCE(escalamiento_realizado, 0) = 0 THEN 1 ELSE 0 END) AS resueltasSinEscalamiento,
      AVG(latencia_ms) AS latenciaPromedio FROM consultas_chat WHERE creado_en >= :dayStartUtc AND creado_en < :dayEndUtc`,
  chatbotTopics: `SELECT COALESCE(NULLIF(tema,''), 'SIN_CLASIFICAR') AS tema, COUNT(*) AS total FROM consultas_chat
    WHERE creado_en >= :dayStartUtc AND creado_en < :dayEndUtc GROUP BY tema ORDER BY total DESC, tema ASC LIMIT 5`,
  unansweredRag: `SELECT pregunta, intencion, creado_en FROM consultas_chat
    WHERE creado_en >= :dayStartUtc AND creado_en < :dayEndUtc AND resolucion = 'SIN_EVIDENCIA'
      AND intencion IN ('POLITICA','MIXTA') ORDER BY creado_en ASC`,
  absenceTrend: `WITH RECURSIVE calendario(dia) AS (
      SELECT DATE_SUB(CAST(:reportDate AS DATE), INTERVAL 29 DAY)
      UNION ALL SELECT DATE_ADD(dia, INTERVAL 1 DAY) FROM calendario WHERE dia < CAST(:reportDate AS DATE)
    ), personas_ausentes AS (
      SELECT DISTINCT i.colaborador_id, calendario.dia FROM calendario JOIN incapacidades i
        ON i.fecha_inicio <= calendario.dia AND i.fecha_fin >= calendario.dia
        AND i.estado IN ('REGISTRADA','EN_REVISION','CERRADA')
      UNION
      SELECT DISTINCT s.colaborador_id, calendario.dia FROM calendario JOIN solicitudes s
        ON s.fecha_inicio <= calendario.dia AND s.fecha_fin >= calendario.dia AND s.estado = 'APROBADA'
    ) SELECT calendario.dia AS fecha, COUNT(personas_ausentes.colaborador_id) AS colaboradores
      FROM calendario LEFT JOIN personas_ausentes ON personas_ausentes.dia = calendario.dia GROUP BY calendario.dia ORDER BY calendario.dia`,
  requestStatuses: `SELECT estado, COUNT(*) AS total FROM solicitudes GROUP BY estado ORDER BY estado`
};

function createReportRepository({ readConnectionFactory = getReadConnection, writeConnectionFactory = getConnection, modelsFactory = initModels, now = () => new Date() } = {}) {
  async function select(sql, bind = {}) {
    return readConnectionFactory().query(sql, { replacements: bind, type: QueryTypes.SELECT });
  }

  async function collectMetrics({ reportDate, monthStart, yearStart, dayStartUtc, dayEndUtc }) {
    const queries = [
      ['active', SQL.activeCollaborators, {}], ['absences', SQL.absences, { reportDate }],
      ['pendingCount', SQL.pendingCount, {}], ['pendingOlder', SQL.pendingOlderThanThreeDays, { reportDate }],
      ['pendingRows', SQL.pendingRows, { reportDate }], ['activeIncapacities', SQL.activeIncapacities, { reportDate }],
      ['incapacityDays', SQL.incapacityDaysMonthToDate, { monthStart, reportDate }],
      ['movements', SQL.monthlyMovements, { monthStart, reportDate }], ['turnover', SQL.turnover, { yearStart, reportDate }],
      ['vacations', SQL.vacationsOverTwenty, {}],
      ['chat', SQL.chatbot, { dayStartUtc, dayEndUtc }], ['topics', SQL.chatbotTopics, { dayStartUtc, dayEndUtc }],
      ['unanswered', SQL.unansweredRag, { dayStartUtc, dayEndUtc }], ['trend', SQL.absenceTrend, { reportDate }],
      ['statuses', SQL.requestStatuses, {}]
    ];
    const rows = await Promise.all(queries.map(([, sql, bind]) => select(sql, bind)));
    return Object.fromEntries(queries.map(([key], index) => [key, rows[index]]));
  }

  function reportModel(connection = writeConnectionFactory()) {
    return modelsFactory(connection).ReporteDiario;
  }

  async function saveReport(report) {
    const connection = writeConnectionFactory();
    const Model = reportModel(connection);
    try {
      return await connection.transaction(async (transaction) => {
        const current = await Model.findOne({ where: { fecha: report.reportDate }, transaction, lock: transaction.LOCK.UPDATE });
        if (current) {
          const metrics = typeof current.metricas === 'string' ? JSON.parse(current.metricas) : current.metricas;
          return { ...metrics, storedAt: current.creado_en, updated: true };
        }
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
    const Model = reportModel(readConnectionFactory());
    const record = await Model.findOne({ where, raw: true, ...options });
    if (!record) return null;
    const metrics = typeof record.metricas === 'string' ? JSON.parse(record.metricas) : record.metricas;
    return { ...metrics, storedAt: record.creado_en };
  }

  async function latest() { return readStoredReport({}, { order: [['fecha', 'DESC']] }); }
  async function byDate(date) { return readStoredReport({ fecha: date }); }
  async function history(limit = 30) {
    const Model = reportModel(readConnectionFactory());
    const rows = await Model.findAll({ attributes: ['fecha', 'metricas', 'creado_en'], order: [['fecha', 'DESC']], limit, raw: true });
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
        if (row) {
          await row.update({ tarea: task, estado: 'EN_PROCESO', inicio_en: now(), finalizo_en: null, error_codigo: null }, { transaction });
        } else {
          await Model.create({ id: randomUUID(), clave_ejecucion: key, tarea: task, estado: 'EN_PROCESO', inicio_en: now() }, { transaction });
        }
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

module.exports = { SQL, createReportRepository };
