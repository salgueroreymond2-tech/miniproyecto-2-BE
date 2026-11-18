'use strict';

const { Router } = require('express');
const { z } = require('zod');
const { authenticate, requireRole } = require('../middleware/authMiddleware');
const { createIngestionController } = require('../controllers/ingestionController');
const HttpError = require('../utils/httpError');

const approvalSchema = z.strictObject({
  driveFileId: z.string().trim().min(1).max(255),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  category: z.enum(['POLITICA', 'PROCEDIMIENTO', 'DOCUMENTO_PUBLICO']),
  effectiveDate: z.iso.date().nullable().optional(),
  legalSources: z.array(z.string().url()).min(1).max(10),
  reviewedNoPersonalData: z.literal(true),
  reviewedNormativeContent: z.literal(true)
});
const emptyBodySchema = z.strictObject({});
const pilotSchema = z.strictObject({ driveFileId: z.string().trim().min(1).max(255) });

function validateBody(schema) {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body || {});
    if (!result.success) throw new HttpError(400, 'Datos de ingesta inválidos.');
    req.validatedBody = result.data;
    next();
  };
}

function rejectQuery(req, _res, next) {
  if (Object.keys(req.query).length) throw new HttpError(400, 'No se admiten parámetros de consulta.');
  next();
}

function createIngestionRouter(authService, agent) {
  const router = Router();
  const controller = createIngestionController(agent);
  router.use(authenticate(authService), requireRole('RRHH'), rejectQuery);
  router.get('/status', controller.status);
  router.get('/candidates', controller.candidates);
  router.post('/approvals', validateBody(approvalSchema), controller.approve);
  router.post('/pilot', validateBody(pilotSchema), controller.pilot);
  router.post('/sync', validateBody(emptyBodySchema), controller.sync);
  return router;
}

module.exports = { createIngestionRouter, approvalSchema, pilotSchema };
