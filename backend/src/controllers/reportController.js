'use strict';

const { z } = require('zod');
const HttpError = require('../utils/httpError');

const limitSchema = z.coerce.number().int().min(1).max(365).default(30);
const dateSchema = z.iso.date();

function createReportController(agent, reportJobs) {
  async function call(operation) {
    try { return await operation(); }
    catch (error) {
      if (error instanceof HttpError) throw error;
      if (error.code === 'DATABASE_NOT_CONFIGURED' || error.name?.startsWith('SequelizeConnection') || ['ECONNREFUSED', 'ETIMEDOUT', 'ER_ACCESS_DENIED_ERROR'].includes(error.code)) {
        throw new HttpError(503, 'El servicio de reportes MySQL no está disponible temporalmente.');
      }
      throw error;
    }
  }
  return {
    latest: async (_req, res) => {
      const report = await call(() => agent.latest());
      if (!report) throw new HttpError(404, 'Todavía no hay reportes almacenados.');
      res.json({ report });
    },
    history: async (req, res) => {
      if (Object.keys(req.query).some((key) => key !== 'limit')) throw new HttpError(400, 'Los filtros del historial no son válidos.');
      const limit = limitSchema.safeParse(req.query.limit);
      if (!limit.success) throw new HttpError(400, 'El límite debe estar entre 1 y 365.');
      res.json({ reports: await call(() => agent.history(limit.data)) });
    },
    byDate: async (req, res) => {
      const date = dateSchema.safeParse(req.params.date);
      if (!date.success) throw new HttpError(400, 'La fecha debe tener formato AAAA-MM-DD.');
      const report = await call(() => agent.byDate(date.data));
      if (!report) throw new HttpError(404, 'No existe un reporte almacenado para esa fecha.');
      res.json({ report });
    },
    generate: async (req, res) => {
      if (Object.keys(req.body || {}).length) throw new HttpError(400, 'No se aceptan campos para generar el reporte del día actual.');
      res.json(await call(() => reportJobs ? reportJobs.generateManualReport() : agent.generateDailyReport()));
    }
  };
}

module.exports = { createReportController, limitSchema, dateSchema };
