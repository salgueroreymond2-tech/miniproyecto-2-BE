'use strict';

const { z } = require('zod');
const HttpError = require('../utils/httpError');

const loginSchema = z.strictObject({
  email: z.string().trim().max(254).email(),
  password: z.string().min(1).refine((value) => Buffer.byteLength(value, 'utf8') <= 72)
});

function validateLogin(req, _res, next) {
  const result = loginSchema.safeParse(req.body);
  if (!result.success) throw new HttpError(400, 'Datos de inicio de sesión inválidos.');
  req.login = result.data;
  next();
}

function rejectQuery(req, _res, next) {
  if (Object.keys(req.query).length !== 0) throw new HttpError(400, 'No se admiten parámetros de consulta.');
  next();
}

module.exports = { validateLogin, rejectQuery };
