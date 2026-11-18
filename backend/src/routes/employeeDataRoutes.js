'use strict';

const { Router } = require('express');
const { rateLimit } = require('express-rate-limit');
const { z } = require('zod');
const { authenticate } = require('../middleware/authMiddleware');
const { rejectQuery } = require('../middleware/validation');
const { createEmployeeDataController } = require('../controllers/employeeDataController');
const HttpError = require('../utils/httpError');

const bodySchema = z.strictObject({
  question: z.string().trim().min(1).max(2000)
});

function validateBody(req, _res, next) {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, 'La pregunta no es válida.');
  req.validatedBody = parsed.data;
  next();
}

function createEmployeeDataRouter(authService, agent) {
  const router = Router();
  const controller = createEmployeeDataController(agent);
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Se alcanzó el límite de consultas. Inténtalo más tarde.' }
  });
  router.use(authenticate(authService), rejectQuery);
  router.post('/', limiter, validateBody, controller.answer);
  return router;
}

module.exports = { createEmployeeDataRouter, bodySchema };
