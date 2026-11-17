'use strict';

const HttpError = require('../utils/httpError');

function authenticate(authService) {
  return async (req, _res, next) => {
    const match = /^Bearer ([^\s]+)$/i.exec(req.get('authorization') || '');
    if (!match) throw new HttpError(401, 'Se requiere autenticación.');
    req.user = await authService.authenticate(match[1]);
    next();
  };
}

function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.rol)) throw new HttpError(403, 'Acceso denegado.');
    next();
  };
}

module.exports = { authenticate, requireRole };
