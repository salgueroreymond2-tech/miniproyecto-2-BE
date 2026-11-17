'use strict';

const { Router } = require('express');
const { rateLimit } = require('express-rate-limit');
const { validateLogin, rejectQuery } = require('../middleware/validation');
const { authenticate } = require('../middleware/authMiddleware');
const { createAuthController } = require('../controllers/authController');

function createAuthRouter(service) {
  const router = Router();
  const controller = createAuthController(service);
  const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: 'Demasiados intentos. Inténtalo más tarde.' } });
  router.post('/login', limiter, rejectQuery, validateLogin, controller.login);
  router.get('/me', authenticate(service), rejectQuery, controller.me);
  return router;
}
module.exports = { createAuthRouter };
