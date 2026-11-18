'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createReportRepository, SQL } = require('../src/repositories/reportRepository');

test('envía agregaciones como consultas parametrizadas a la conexión de solo lectura', async () => {
  const calls = [];
  const reader = { query: async (sql, options) => { calls.push({ sql, options }); return []; } };
  const repository = createReportRepository({ readConnectionFactory: () => reader });
  const result = await repository.collectMetrics({ reportDate: '2026-11-18', monthStart: '2026-11-01', yearStart: '2026-01-01', dayStartUtc: '2026-11-17 06:00:00', dayEndUtc: '2026-11-18 06:00:00' });
  assert.equal(calls.length, Object.keys(SQL).length);
  assert.equal(Object.keys(result).length, Object.keys(SQL).length);
  assert.ok(calls.some((call) => call.options.replacements.reportDate === '2026-11-18'));
  assert.ok(calls.every((call) => call.options.type));
  assert.ok(calls.every((call) => !call.sql.includes('2026-11-18')));
});

test('guarda una sola fotografía por fecha y conserva la primera escritura concurrente', async () => {
  const rows = new Map();
  let creates = 0;
  const transaction = { LOCK: { UPDATE: 'UPDATE' } };
  const connection = { transaction: async (operation) => operation(transaction) };
  const ReporteDiario = {
    findOne: async ({ where }) => rows.get(where.fecha) || null,
    create: async (record) => { creates += 1; rows.set(record.fecha, { ...record }); }
  };
  const repository = createReportRepository({ writeConnectionFactory: () => connection, modelsFactory: () => ({ ReporteDiario }), now: () => new Date('2026-11-18T12:00:00Z') });
  const first = { reportDate: '2026-11-18', metric: 1 };
  const stored = await repository.saveReport(first);
  assert.equal(stored.metric, 1);
  const second = await repository.saveReport({ reportDate: '2026-11-18', metric: 2 });
  assert.equal(second.metric, 1);
  assert.equal(second.updated, true);
  assert.equal(creates, 1);
  assert.equal(rows.get('2026-11-18').metricas.metric, 1);
});
