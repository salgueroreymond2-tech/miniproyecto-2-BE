'use strict';

const { Router } = require('express');
const { rateLimit } = require('express-rate-limit');
const { z } = require('zod');
const { authenticate } = require('../middleware/authMiddleware');
const { createChatController } = require('../controllers/chatController');
const HttpError = require('../utils/httpError');

const postSchema = z.strictObject({
  question: z.string().trim().min(1).max(4000),
  requestId: z.string().uuid(),
  conversationId: z.string().uuid().optional()
});

function validatePost(req, _res, next) {
  const parsed = postSchema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, 'La solicitud de chat no es válida.');
  req.validatedBody = parsed.data;
  next();
}

function createChatRouter(authService, orchestrator) {
  const router = Router();
  const controller = createChatController(orchestrator);
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Se alcanzó el límite de consultas. Inténtalo más tarde.' }
  });
  router.use(authenticate(authService));
  router.post('/', limiter, validatePost, controller.post);
  router.get('/history', controller.history);
  router.get('/conversations', controller.conversations);
  router.get('/conversations/:id', controller.conversation);
  return router;
}

module.exports = { createChatRouter, postSchema };
