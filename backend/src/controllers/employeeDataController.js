'use strict';

const HttpError = require('../utils/httpError');

function createEmployeeDataController(agent) {
  return {
    answer: async (req, res) => {
      try {
        // La identidad se toma de authenticate(); el cuerpo solo contiene question.
        const result = await agent.answer({
          question: req.validatedBody.question,
          authenticatedUserId: req.user.id
        });
        return res.json(result);
      } catch (error) {
        if (error.name === 'ZodError') throw new HttpError(400, 'La pregunta o la selección de herramienta no es válida.');
        if (error.code === 'DATABASE_NOT_CONFIGURED' ||
          String(error.code || '').startsWith('DEEPSEEK_') ||
          String(error.name || '').startsWith('SequelizeConnection') ||
          ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'ER_ACCESS_DENIED_ERROR'].includes(error.code)) {
          throw new HttpError(503, 'La consulta de datos personales no está disponible temporalmente.');
        }
        throw error;
      }
    }
  };
}

module.exports = { createEmployeeDataController };
