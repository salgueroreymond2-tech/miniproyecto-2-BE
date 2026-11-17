'use strict';
require('dotenv').config();
const { z } = require('zod');
const { createDeepSeekService } = require('../services/deepseek.service');

async function main() {
  const service = createDeepSeekService();
  const availability = await service.verifyModelAvailability();
  if (!availability.available) throw new Error('El modelo configurado no aparece en la lista de DeepSeek.');
  const result = await service.generateStructured({ messages: [{ role: 'user', content: 'Para una prueba técnica, devuelve el objeto JSON {"mensaje":"funciona"}.' }], maxTokens: 128 }, z.object({ mensaje: z.string().min(1) }));
  console.log(JSON.stringify({ model: availability.model, available: true, respuestaRecibida: true, formatoValido: true, latencyMs: result.latencyMs }, null, 2));
}
main().catch((error) => { console.error('No se pudo verificar DeepSeek:', error.code || error.message, error.status || ''); process.exitCode = 1; });
