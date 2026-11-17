'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { z } = require('zod');
const { createDeepSeekService } = require('../src/services/deepseek.service');

process.env.DEEPSEEK_API_KEY = 'clave-ficticia-de-prueba';
process.env.DEEPSEEK_MODEL = 'deepseek-flash';
process.env.DEEPSEEK_TIMEOUT_MS = '1000';
const silent = { info() {} };
const ok = (data) => ({ ok: true, status: 200, json: async () => data });

test('verifica el modelo y valida una respuesta JSON estructurada', async () => {
  const calls = [];
  const service = createDeepSeekService({ logger: silent, fetchImpl: async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/models')) return ok({ data: [{ id: 'deepseek-flash' }] });
    return ok({ model: 'deepseek-flash', choices: [{ finish_reason: 'stop', message: { content: '{"mensaje":"correcto"}' } }] });
  } });
  assert.equal((await service.verifyModelAvailability()).available, true);
  const response = await service.generateStructured({ messages: [{ role: 'user', content: 'Prueba' }] }, z.object({ mensaje: z.string() }));
  assert.equal(response.data.mensaje, 'correcto');
  assert.equal(JSON.parse(calls[1].options.body).response_format.type, 'json_object');
  assert.ok(response.latencyMs >= 0);
});

test('gestiona errores HTTP, timeout, JSON inválido y esquema incorrecto', async () => {
  const make = (fetchImpl) => createDeepSeekService({ logger: silent, fetchImpl });
  await assert.rejects(make(async () => ({ ok: false, status: 401 })).verifyModelAvailability(), { code: 'DEEPSEEK_HTTP_ERROR', status: 401 });
  await assert.rejects(make(async () => { throw Object.assign(new Error(), { name: 'TimeoutError' }); }).verifyModelAvailability(), { code: 'DEEPSEEK_TIMEOUT' });
  const completion = (content) => ok({ model: 'deepseek-flash', choices: [{ finish_reason: 'stop', message: { content } }] });
  await assert.rejects(make(async () => completion('no-json')).generateStructured({ messages: [{ role: 'user', content: 'prueba' }] }), { code: 'DEEPSEEK_INVALID_JSON' });
  await assert.rejects(make(async () => completion('{}')).generateStructured({ messages: [{ role: 'user', content: 'prueba' }] }), { code: 'DEEPSEEK_SCHEMA_ERROR' });
});
