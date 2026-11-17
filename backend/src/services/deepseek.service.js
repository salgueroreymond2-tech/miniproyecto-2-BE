'use strict';

const { performance } = require('node:perf_hooks');
const { z } = require('zod');

const API_URL = 'https://api.deepseek.com';
const messageSchema = z.strictObject({ role: z.enum(['system', 'user', 'assistant']), content: z.string().trim().min(1).max(20000) });
const requestSchema = z.strictObject({ messages: z.array(messageSchema).min(1).max(20), maxTokens: z.number().int().min(1).max(4096).default(512) });
const modelsResponseSchema = z.object({ data: z.array(z.object({ id: z.string() })) });
const completionResponseSchema = z.object({ model: z.string(), choices: z.array(z.object({ finish_reason: z.string(), message: z.object({ content: z.string().nullable() }) })).min(1), usage: z.object({ prompt_tokens: z.number().int().nonnegative(), completion_tokens: z.number().int().nonnegative() }).optional() });
const defaultResponseSchema = z.strictObject({ respuesta: z.string().min(1), fuentes: z.array(z.string()), informacion_suficiente: z.boolean() });

class DeepSeekError extends Error {
  constructor(code, message, status) { super(message); this.name = 'DeepSeekError'; this.code = code; this.status = status; }
}

function createDeepSeekService({ fetchImpl = globalThis.fetch, logger = console } = {}) {
  function configuration() {
    const parsed = z.object({
      DEEPSEEK_API_KEY: z.string().min(1),
      DEEPSEEK_MODEL: z.string().trim().min(1).default('deepseek-flash'),
      DEEPSEEK_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(30000)
    }).safeParse(process.env);
    if (!parsed.success) throw new DeepSeekError('DEEPSEEK_NOT_CONFIGURED', 'La configuración de DeepSeek está incompleta o es inválida.');
    return parsed.data;
  }

  async function request(endpoint, { method = 'GET', body } = {}) {
    const config = configuration();
    const started = performance.now();
    let status;
    try {
      const response = await fetchImpl(API_URL + endpoint, {
        method, headers: { Authorization: `Bearer ${config.DEEPSEEK_API_KEY}`, 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(config.DEEPSEEK_TIMEOUT_MS)
      });
      status = response.status;
      if (!response.ok) throw new DeepSeekError('DEEPSEEK_HTTP_ERROR', 'DeepSeek rechazó la solicitud.', status);
      try { return { data: await response.json(), latencyMs: Math.round(performance.now() - started), model: config.DEEPSEEK_MODEL }; }
      catch { throw new DeepSeekError('DEEPSEEK_INVALID_RESPONSE', 'DeepSeek devolvió una respuesta inválida.', status); }
    } catch (error) {
      if (error instanceof DeepSeekError) throw error;
      if (error.name === 'TimeoutError' || error.name === 'AbortError') throw new DeepSeekError('DEEPSEEK_TIMEOUT', 'La solicitud a DeepSeek agotó el tiempo de espera.');
      throw new DeepSeekError('DEEPSEEK_NETWORK_ERROR', 'No se pudo conectar con DeepSeek.');
    } finally {
      // Se registra duración y estado, nunca prompts, respuestas, tokens ni secretos.
      logger.info?.({ provider: 'deepseek', endpoint, status: status || null, latencyMs: Math.round(performance.now() - started) });
    }
  }

  async function verifyModelAvailability() {
    const result = await request('/models');
    const models = modelsResponseSchema.safeParse(result.data);
    if (!models.success) throw new DeepSeekError('DEEPSEEK_INVALID_RESPONSE', 'La lista de modelos no tiene el formato esperado.');
    return { model: result.model, available: models.data.data.some((item) => item.id === result.model), latencyMs: result.latencyMs };
  }

  async function generateStructured(input, responseSchema = defaultResponseSchema) {
    const parsed = requestSchema.parse(input);
    if (!responseSchema || typeof responseSchema.safeParse !== 'function') throw new TypeError('Se requiere un esquema Zod para validar la respuesta.');
    const config = configuration();
    const outputSchema = JSON.stringify(z.toJSONSchema(responseSchema));
    const messages = [{ role: 'system', content: `Responde únicamente con un objeto JSON válido que cumpla este esquema JSON: ${outputSchema}. Si falta información, indícalo y no inventes datos.` }, ...parsed.messages];
    const result = await request('/chat/completions', { method: 'POST', body: { model: config.DEEPSEEK_MODEL, messages, response_format: { type: 'json_object' }, max_tokens: parsed.maxTokens, stream: false } });
    const completion = completionResponseSchema.safeParse(result.data);
    if (!completion.success || completion.data.choices[0].finish_reason !== 'stop') throw new DeepSeekError('DEEPSEEK_INCOMPLETE_RESPONSE', 'La respuesta de DeepSeek está incompleta o es inválida.');
    let output;
    try { output = JSON.parse(completion.data.choices[0].message.content || ''); }
    catch { throw new DeepSeekError('DEEPSEEK_INVALID_JSON', 'DeepSeek no devolvió un objeto JSON válido.'); }
    const validated = responseSchema.safeParse(output);
    if (!validated.success) throw new DeepSeekError('DEEPSEEK_SCHEMA_ERROR', 'La respuesta no cumple el formato esperado.');
    return { data: validated.data, model: completion.data.model, latencyMs: result.latencyMs, usage: completion.data.usage || null };
  }
  return { verifyModelAvailability, generateStructured };
}

module.exports = { createDeepSeekService, DeepSeekError, defaultResponseSchema };
