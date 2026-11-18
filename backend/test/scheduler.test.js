'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createScheduler } = require('../src/jobs/scheduler');

test('registra horarios de Costa Rica, evita ejecución duplicada y registra resultado o error', async () => {
  const scheduled = [];
  const statuses = new Map();
  const finished = [];
  const calls = { sync: 0, report: 0 };
  const repository = {
    claimExecution: async ({ key }) => {
      if (statuses.has(key) && statuses.get(key) === 'COMPLETADO') return false;
      statuses.set(key, 'EN_PROCESO');
      return true;
    },
    finishExecution: async (key, data) => { statuses.set(key, data.status); finished.push({ key, ...data }); }
  };
  const cron = { schedule: (expression, callback, options) => { scheduled.push({ expression, callback, options, stop() {} }); return { stop() {} }; } };
  const scheduler = createScheduler({
    cron, repository, now: () => new Date('2026-11-18T15:00:00Z'), logger: { info() {}, error() {} },
    ingestionAgent: { sync: async () => { calls.sync += 1; return { documentsUpdated: 2 }; } },
    analystAgent: { latest: async () => ({ reportDate: '2026-11-17' }), byDate: async (date) => date === '2026-11-18' ? null : ({ reportDate: date }), generateDailyReport: async () => { calls.report += 1; return { created: true, reused: false }; } }
  });
  await scheduler.start();
  assert.deepEqual(scheduled.map((task) => task.expression), ['0 6 * * *', '0 7 * * *']);
  assert.ok(scheduled.every((task) => task.options.timezone === 'America/Costa_Rica' && task.options.noOverlap));
  assert.deepEqual(calls, { sync: 1, report: 1 });
  await scheduler.runDailyReport();
  assert.equal(calls.report, 1);
  assert.equal(finished.filter((item) => item.status === 'COMPLETADO').length, 2);
  scheduler.stop();
});

test('marca como fallida una tarea cron que termina con error', async () => {
  let completion;
  const scheduler = createScheduler({
    cron: { schedule: () => ({ stop() {} }) },
    repository: { claimExecution: async () => true, finishExecution: async (_key, result) => { completion = result; } },
    now: () => new Date('2026-11-18T10:00:00Z'), logger: { info() {}, error() {} },
    ingestionAgent: { sync: async () => { throw Object.assign(new Error('fallo'), { code: 'DRIVE_UNAVAILABLE' }); } },
    analystAgent: { latest: async () => null, byDate: async () => null, generateDailyReport: async () => ({}) }
  });
  await assert.rejects(scheduler.runDriveSync(), { code: 'DRIVE_UNAVAILABLE' });
  assert.deepEqual(completion, { status: 'FALLIDO', errorCode: 'DRIVE_UNAVAILABLE' });
});

test('registra la generación manual idempotente sin guardar el expediente del reporte en el log', async () => {
  let audit;
  const report = { reportDate: '2026-11-18', pendingRows: [{ name: 'Colaboradora ficticia' }] };
  const scheduler = createScheduler({
    cron: { schedule: () => ({ stop() {} }) },
    repository: { claimExecution: async () => true, finishExecution: async (_key, result) => { audit = result; } },
    now: () => new Date('2026-11-18T15:00:00Z'), logger: { info() {}, error() {} },
    ingestionAgent: { sync: async () => ({}) },
    analystAgent: { byDate: async () => report, generateDailyReport: async () => ({ report, created: true, reused: false }) }
  });
  const result = await scheduler.generateManualReport();
  assert.equal(result.report, report);
  assert.deepEqual(audit, { status: 'COMPLETADO', result: { reportDate: '2026-11-18', created: true, reused: false } });
});
