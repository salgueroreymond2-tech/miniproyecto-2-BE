'use strict';

const { z } = require('zod');
const HttpError = require('../utils/httpError');

const historyQuerySchema = z.strictObject({
  conversationId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50)
});
const conversationsQuerySchema = z.strictObject({
  limit: z.coerce.number().int().min(1).max(100).default(50)
});
const conversationIdSchema = z.string().uuid();

function createChatController(orchestrator) {
  return {
    post: async (req, res) => {
      try {
        const result = await orchestrator.answer({
          question: req.validatedBody.question,
          requestId: req.validatedBody.requestId,
          conversationId: req.validatedBody.conversationId ?? null,
          userId: req.user.id,
          role: req.user.rol
        });
        return res.json(result);
      } catch (error) {
        if (error instanceof HttpError) throw error;
        if (error.name === 'ZodError') throw new HttpError(400, 'La solicitud de chat no es válida.');
        throw error;
      }
    },
    history: async (req, res) => {
      const parsed = historyQuerySchema.safeParse(req.query);
      if (!parsed.success) throw new HttpError(400, 'Los filtros del historial no son válidos.');
      res.json({ messages: await orchestrator.getHistory(req.user.id, parsed.data) });
    },
    conversations: async (req, res) => {
      const parsed = conversationsQuerySchema.safeParse(req.query);
      if (!parsed.success) throw new HttpError(400, 'El límite de conversaciones no es válido.');
      res.json({ conversations: await orchestrator.listConversations(req.user.id, parsed.data.limit) });
    },
    conversation: async (req, res) => {
      const parsedId = conversationIdSchema.safeParse(req.params.id);
      if (!parsedId.success) throw new HttpError(400, 'El identificador de conversación no es válido.');
      const parsedLimit = z.coerce.number().int().min(1).max(200).default(100).safeParse(req.query.limit);
      if (!parsedLimit.success || Object.keys(req.query).some((key) => key !== 'limit')) {
        throw new HttpError(400, 'El límite de mensajes no es válido.');
      }
      res.json({ conversation: await orchestrator.getConversation(req.user.id, parsedId.data, parsedLimit.data) });
    }
  };
}

module.exports = { createChatController, historyQuerySchema, conversationsQuerySchema };
