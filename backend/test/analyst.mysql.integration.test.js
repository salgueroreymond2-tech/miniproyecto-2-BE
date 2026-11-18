'use strict';

require('dotenv').config();
const test = require('node:test');
const assert = require('node:assert/strict');
const { QueryTypes } = require('sequelize');
const { getReadConnection, closePool } = require('../src/config/database');
const { createReportRepository } = require('../src/repositories/reportRepository');
const { createAnalystAgent, localDate, dateParameters } = require('../src/services/analyst.agent');

const canRun = Boolean(process.env.DB_READ_USER && process.env.DB_READ_PASSWORD);

test('compara cada indicador del reporte con agregaciones SQL independientes de solo lectura', { skip: canRun ? false : 'Faltan DB_READ_USER y DB_READ_PASSWORD; no se usa la cuenta de escritura para esta prueba.' }, async () => {
  const readDb = getReadConnection();
  const sourceRepository = createReportRepository();
  const repository = {
    byDate: async () => null,
    collectMetrics: sourceRepository.collectMetrics,
    saveReport: async (report) => report,
    latest: async () => null,
    history: async () => []
  };
  const agent = createAnalystAgent({ repository, deepSeekService: { generateStructured: async () => ({ data: { sentences: ['active', 'absences', 'requests'] } }) }, logger: { warn() {} } });
  try {
    const reportDate = localDate();
    const periods = dateParameters(reportDate);
    const { report } = await agent.generateDailyReport({ date: reportDate });
    async function independent(sql, replacements = {}) {
      const [row] = await readDb.query(sql, { replacements, type: QueryTypes.SELECT });
      return row;
    }
    const active = await independent("SELECT COUNT(*) AS total FROM colaboradores WHERE estado='ACTIVO'");
    const absent = await independent(`SELECT COUNT(DISTINCT persona_id) AS total FROM (
      SELECT i.colaborador_id AS persona_id FROM incapacidades i JOIN colaboradores c ON c.id=i.colaborador_id
        WHERE c.estado='ACTIVO' AND i.estado IN ('REGISTRADA','EN_REVISION') AND i.fecha_inicio<=:reportDate AND i.fecha_fin>=:reportDate
      UNION SELECT s.colaborador_id FROM solicitudes s JOIN colaboradores c ON c.id=s.colaborador_id
        WHERE c.estado='ACTIVO' AND s.estado='APROBADA' AND s.fecha_inicio<=:reportDate AND s.fecha_fin>=:reportDate
    ) personas`, { reportDate });
    const absenceGroups = await readDb.query(`SELECT tipo,departamento,COUNT(*) AS people FROM (
      SELECT classified.*,ROW_NUMBER() OVER(PARTITION BY colaborador_id ORDER BY prioridad,tipo) AS positionInDay FROM (
        SELECT i.colaborador_id,'INCAPACIDAD' AS tipo,d.nombre AS departamento,1 AS prioridad FROM incapacidades i
          JOIN colaboradores c ON c.id=i.colaborador_id JOIN departamentos d ON d.id=c.departamento_id
          WHERE c.estado='ACTIVO' AND i.estado IN ('REGISTRADA','EN_REVISION') AND i.fecha_inicio<=:reportDate AND i.fecha_fin>=:reportDate
        UNION ALL SELECT s.colaborador_id,s.tipo,d.nombre,2 FROM solicitudes s JOIN colaboradores c ON c.id=s.colaborador_id
          JOIN departamentos d ON d.id=c.departamento_id WHERE c.estado='ACTIVO' AND s.estado='APROBADA'
          AND s.fecha_inicio<=:reportDate AND s.fecha_fin>=:reportDate
      ) classified
    ) ranked WHERE positionInDay=1 GROUP BY tipo,departamento ORDER BY tipo,departamento`, { replacements: { reportDate }, type: QueryTypes.SELECT });
    const pending = await independent("SELECT COUNT(*) AS total FROM solicitudes WHERE estado='PENDIENTE'");
    const older = await independent("SELECT COUNT(*) AS total FROM solicitudes WHERE estado='PENDIENTE' AND DATEDIFF(:reportDate,DATE(creado_en))>3", { reportDate });
    const incapacity = await independent(`SELECT COUNT(*) AS casesCount,COUNT(DISTINCT i.colaborador_id) AS peopleCount FROM incapacidades i
      JOIN colaboradores c ON c.id=i.colaborador_id WHERE c.estado='ACTIVO' AND i.estado IN ('REGISTRADA','EN_REVISION')
      AND i.fecha_inicio<=:reportDate AND i.fecha_fin>=:reportDate`, { reportDate });
    const incapDays = await independent(`WITH RECURSIVE dates(d) AS (
      SELECT CAST(:monthStart AS DATE) UNION ALL SELECT DATE_ADD(d,INTERVAL 1 DAY) FROM dates WHERE d<CAST(:reportDate AS DATE)
    ) SELECT COUNT(*) AS total FROM (SELECT DISTINCT i.colaborador_id,dates.d FROM dates JOIN incapacidades i
      ON i.fecha_inicio<=dates.d AND i.fecha_fin>=dates.d) distinct_days`, periods);
    const movement = await independent(`SELECT COUNT(DISTINCT CASE WHEN tipo='INGRESO' THEN colaborador_id END) AS hires,
      COUNT(DISTINCT CASE WHEN tipo='SALIDA' THEN colaborador_id END) AS exits FROM movimientos_personal
      WHERE fecha_efectiva BETWEEN :monthStart AND :reportDate`, periods);
    const turnover = await independent(`SELECT
      (SELECT COUNT(*) FROM colaboradores WHERE fecha_ingreso<=:yearStart AND (fecha_salida IS NULL OR fecha_salida>:yearStart)) AS opening,
      (SELECT COUNT(*) FROM colaboradores WHERE fecha_ingreso<=:reportDate AND (fecha_salida IS NULL OR fecha_salida>:reportDate)) AS currentCount,
      (SELECT COUNT(DISTINCT colaborador_id) FROM movimientos_personal WHERE tipo='SALIDA' AND fecha_efectiva BETWEEN :yearStart AND :reportDate) AS exits`, periods);
    const vacation = await independent(`SELECT COUNT(*) AS total FROM (
      SELECT c.id FROM colaboradores c JOIN saldos_vacaciones v ON v.colaborador_id=c.id WHERE c.estado='ACTIVO'
      GROUP BY c.id HAVING SUM(v.dias_disponibles)>20
    ) balances`);
    const chat = await independent(`SELECT COUNT(*) AS total,SUM(resolucion='RESPONDIDA' AND COALESCE(escalamiento_realizado,0)=0) AS resolved,AVG(latencia_ms) AS latency
      FROM consultas_chat WHERE creado_en>=:dayStartUtc AND creado_en<:dayEndUtc`, periods);
    const topics = await readDb.query(`SELECT COALESCE(NULLIF(tema,''),'SIN_CLASIFICAR') AS tema,COUNT(*) AS total FROM consultas_chat
      WHERE creado_en>=:dayStartUtc AND creado_en<:dayEndUtc GROUP BY tema ORDER BY total DESC,tema ASC LIMIT 5`, { replacements: periods, type: QueryTypes.SELECT });
    const unanswered = await independent(`SELECT COUNT(*) AS total FROM consultas_chat WHERE creado_en>=:dayStartUtc AND creado_en<:dayEndUtc
      AND resolucion='SIN_EVIDENCIA' AND intencion IN ('POLITICA','MIXTA')`, periods);
    const statuses = await readDb.query('SELECT estado,COUNT(*) AS total FROM solicitudes GROUP BY estado ORDER BY estado', { type: QueryTypes.SELECT });
    const trend = await readDb.query(`WITH RECURSIVE dates(d) AS (
      SELECT DATE_SUB(CAST(:reportDate AS DATE),INTERVAL 29 DAY) UNION ALL SELECT DATE_ADD(d,INTERVAL 1 DAY) FROM dates WHERE d<CAST(:reportDate AS DATE)
    ), people AS (
      SELECT DISTINCT i.colaborador_id,dates.d FROM dates JOIN incapacidades i ON i.fecha_inicio<=dates.d AND i.fecha_fin>=dates.d
        AND i.estado IN ('REGISTRADA','EN_REVISION','CERRADA')
      UNION SELECT DISTINCT s.colaborador_id,dates.d FROM dates JOIN solicitudes s ON s.fecha_inicio<=dates.d AND s.fecha_fin>=dates.d AND s.estado='APROBADA'
    ) SELECT dates.d AS dateValue,COUNT(people.colaborador_id) AS peopleCount FROM dates LEFT JOIN people ON people.d=dates.d GROUP BY dates.d ORDER BY dates.d`,
    { replacements: { reportDate }, type: QueryTypes.SELECT });
    const expectedRate = Number((Number(turnover.exits) * 100 / ((Number(turnover.opening) + Number(turnover.currentCount)) / 2 || 1)).toFixed(2));
    assert.equal(report.indicators.activeCollaborators, Number(active.total));
    assert.equal(report.absences.totalPeople, Number(absent.total));
    assert.deepEqual(report.absences.byTypeDepartment.map((row) => [row.type, row.department, row.collaborators]), absenceGroups.map((row) => [row.tipo, row.departamento, Number(row.people)]));
    assert.equal(report.requests.pendingCount, Number(pending.total));
    assert.equal(report.requests.olderThanThreeDaysCount, Number(older.total));
    assert.equal(report.incapacities.activeCount, Number(incapacity.casesCount));
    assert.equal(report.incapacities.activeCollaborators, Number(incapacity.peopleCount));
    assert.equal(report.incapacities.daysMonthToDate, Number(incapDays.total));
    assert.deepEqual(report.turnover.month, { hires: Number(movement.hires), exits: Number(movement.exits) });
    assert.equal(report.turnover.yearToDate.ratePercent, Number(turnover.opening) + Number(turnover.currentCount) === 0 ? 0 : expectedRate);
    assert.equal(report.turnover.yearToDate.openingHeadcount, Number(turnover.opening));
    assert.equal(report.turnover.yearToDate.currentHeadcount, Number(turnover.currentCount));
    assert.equal(report.turnover.yearToDate.distinctExits, Number(turnover.exits));
    assert.equal(report.vacations.over20DaysCount, Number(vacation.total));
    assert.equal(report.chatbot.totalQueries, Number(chat.total));
    assert.equal(report.chatbot.resolvedWithoutEscalation, Number(chat.resolved || 0));
    assert.equal(report.chatbot.percentResolvedWithoutEscalation, chat.total ? Number((Number(chat.resolved || 0) * 100 / Number(chat.total)).toFixed(2)) : 0);
    assert.equal(report.chatbot.averageLatencyMs, chat.latency === null ? null : Number(Number(chat.latency).toFixed(2)));
    assert.deepEqual(report.chatbot.topTopics.map((row) => [row.topic, row.count]), topics.map((row) => [row.tema, Number(row.total)]));
    assert.equal(report.chatbot.ragUnansweredQuestions.length, Number(unanswered.total));
    assert.deepEqual(report.requests.byStatus.map((row) => [row.status, row.count]), statuses.map((row) => [row.estado, Number(row.total)]));
    assert.deepEqual(report.absences.trend30Days.map((row) => [row.date, row.collaborators]), trend.map((row) => [String(row.dateValue).slice(0, 10), Number(row.peopleCount)]));
  } finally {
    await closePool();
  }
});
