'use strict';

const { TIME_ZONE, localDate } = require('../services/analyst.agent');
const HttpError = require('../utils/httpError');

function createScheduler({ ingestionAgent, analystAgent, repository, cron, logger = console, now = () => new Date() }) {
  const active = new Set();
  const scheduledTasks = [];

  async function runOnce(task, key, operation, auditResult = (result) => result) {
    if (active.has(task)) return { skipped: true, reason: 'LOCAL_RUN_IN_PROGRESS' };
    active.add(task);
    let claimed = false;
    try {
      claimed = await repository.claimExecution({ key, task });
      if (!claimed) return { skipped: true, reason: 'ALREADY_CLAIMED_OR_COMPLETED' };
      const result = await operation();
      await repository.finishExecution(key, { status: 'COMPLETADO', result: auditResult(result) });
      logger.info?.({ scheduler: task, date: localDate(now()), status: 'COMPLETADO' });
      return result;
    } catch (error) {
      if (claimed) {
        try { await repository.finishExecution(key, { status: 'FALLIDO', errorCode: String(error.code || error.name || 'ERROR').slice(0, 120) }); }
        catch (recordError) { logger.error?.({ scheduler: task, status: 'ERROR_REGISTRO', code: recordError.code || recordError.name }); }
      }
      logger.error?.({ scheduler: task, status: 'FALLIDO', code: error.code || error.name || 'ERROR' });
      throw error;
    } finally {
      active.delete(task);
    }
  }

  const runDriveSync = () => {
    const date = localDate(now());
    return runOnce('drive-sync', `drive-sync:${date}`, () => ingestionAgent.sync());
  };
  const runDailyReport = () => {
    const date = localDate(now());
    return runOnce('daily-report', `daily-report:${date}`, async () => {
      const generated = await analystAgent.generateDailyReport({ date });
      return { reportDate: date, created: generated.created, reused: generated.reused };
    });
  };

  async function generateManualReport() {
    const date = localDate(now());
    const result = await runOnce('daily-report', `daily-report:${date}`, () => analystAgent.generateDailyReport({ date }),
      (generated) => ({ reportDate: date, created: generated.created, reused: generated.reused }));
    if (result?.skipped) {
      const report = await analystAgent.byDate(date);
      if (!report) throw new HttpError(409, 'El reporte de hoy todavía está en proceso.');
      return { report, created: false, reused: true };
    }
    return result;
  }

  async function recoverMissedRuns() {
    const date = localDate(now());
    const timeParts = new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now()).split(':').map(Number);
    const minutes = timeParts[0] * 60 + timeParts[1];
    if (minutes < 6 * 60) return { recovered: [] };
    const recovered = [];
    try { await runOnce('drive-sync', `drive-sync:${date}`, () => ingestionAgent.sync()); recovered.push('drive-sync'); }
    catch { recovered.push('drive-sync-failed'); }
    if (minutes >= 7 * 60) {
      try {
        const stored = await analystAgent.byDate(date);
        if (!stored) {
          await runOnce('daily-report', `daily-report:${date}`, async () => {
            const generated = await analystAgent.generateDailyReport({ date });
            return { reportDate: date, created: generated.created, reused: generated.reused };
          });
          recovered.push('daily-report');
        }
      } catch (error) {
        logger.error?.({ scheduler: 'daily-report-recovery', status: 'FALLIDO', code: error.code || error.name });
        recovered.push('daily-report-failed');
      }
    }
    return { recovered };
  }

  function start() {
    if (!cron || typeof cron.schedule !== 'function') throw new TypeError('Se requiere node-cron para programar las tareas.');
    scheduledTasks.push(cron.schedule('0 6 * * *', () => runDriveSync().catch(() => {}), { timezone: TIME_ZONE, noOverlap: true }));
    scheduledTasks.push(cron.schedule('0 7 * * *', () => runDailyReport().catch(() => {}), { timezone: TIME_ZONE, noOverlap: true }));
    return recoverMissedRuns();
  }

  function stop() { for (const task of scheduledTasks.splice(0)) task.stop?.(); }

  return { start, stop, runDriveSync, runDailyReport, generateManualReport, recoverMissedRuns };
}

function createDefaultScheduler(options) {
  return createScheduler({ ...options, cron: options?.cron || require('node-cron') });
}

module.exports = { createScheduler, createDefaultScheduler };
