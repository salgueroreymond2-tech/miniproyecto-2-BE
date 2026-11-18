'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const { createApp } = require('../src/app');
const { createOrchestratorAgent, classificationSchema } = require('../src/services/orchestrator.agent');

const SECRET = 'test-secret-for-orchestrator-only-123456';
const USER_ID = '00000000-0000-4000-8000-000000000001';
const RRHH_ID = '00000000-0000-4000-8000-000000000002';
const CONVERSATION_ID = '10000000-0000-4000-8000-000000000001';
const REQUEST_ID = '20000000-0000-4000-8000-000000000001';
const MESSAGE_ID = '30000000-0000-4000-8000-000000000001';
const CHUNK_ID = '40000000-0000-4000-8000-000000000001';
const DOCUMENT_ID = '50000000-0000-4000-8000-000000000001';

function classification(intent, overrides = {}) {
  return { intent, topic: 'VACACIONES', confidence: 0.98, needsClarification: false, ...overrides };
}

function createHarness({ result = classification('FUERA_DE_ALCANCE'), context = [] } = {}) {
  const calls = { classify: [], policies: [], personal: [], complete: [], failed: [] };
  const repository = {
    reserveMessage: async () => ({ status: 'RESERVED', messageId: MESSAGE_ID, conversationId: CONVERSATION_ID }),
    getConversationContext: async (...args) => { calls.contextArgs = args; return context; },
    completeMessage: async (record) => { calls.complete.push(record); },
    failMessage: async (record) => { calls.failed.push(record); },
    listConversations: async (id, limit) => [{ id, limit }],
    getHistory: async (id, options) => [{ id, options }],
    getConversation: async (id, conversationId, limit) => ({ id, conversationId, limit })
  };
  const policyAgent = {
    answer: async (input) => {
      calls.policies.push(input);
      return {
        answer: 'Según la política: extracto literal [1].',
        resolution: 'RESPONDIDA',
        citations: [{ reference: 1, title: 'Política de vacaciones', section: 'Acumulación', version: '1.0', link: 'https://drive.google.com/open?id=ficticio' }],
        documentsCited: [{ title: 'Política de vacaciones', version: '1.0' }],
        retrievedFragments: [{ id: CHUNK_ID, similarity: 0.91, cited: true }]
      };
    }
  };
  const personalDataAgent = {
    answer: async (input) => {
      calls.personal.push(input);
      return {
        answer: 'Tienes exactamente 12.00 días disponibles. Fuente de datos: MySQL.',
        resolved: true,
        escalationSuggested: false,
        escalated: false,
        citations: []
      };
    }
  };
  const deepSeekService = {
    generateStructured: async (requestBody, schema) => {
      calls.classify.push({ requestBody, schema });
      return { data: result };
    }
  };
  const agent = createOrchestratorAgent({ repository, policyAgent, personalDataAgent, deepSeekService, systemPrompt: 'Prompt de prueba.' });
  return { agent, calls, repository };
}

test('el clasificador valida la intención y el tema enumerado con Zod', () => {
  assert.equal(classificationSchema.safeParse(classification('MIXTA')).success, true);
  assert.equal(classificationSchema.safeParse(classification('SQL')).success, false);
  assert.equal(classificationSchema.safeParse(classification('POLITICA', { topic: 'SALARIO_PERSONAL' })).success, false);
  assert.equal(classificationSchema.safeParse({ ...classification('POLITICA'), extra: 'razonamiento' }).success, false);
});

test('rechaza la consulta sobre vacaciones de un compañero en backend antes de llamar a DeepSeek', async () => {
  const { agent, calls } = createHarness({ result: classification('DATO_PERSONAL') });
  const response = await agent.answer({
    question: '¿Cuántos días de vacaciones tiene mi compañero Juan?',
    userId: USER_ID, role: 'COLABORADOR', requestId: REQUEST_ID
  });
  assert.equal(response.intent, 'RESTRINGIDA');
  assert.match(response.answer, /No puedo consultar ni revelar información privada/);
  assert.equal(calls.classify.length, 0);
  assert.equal(calls.personal.length, 0);
  assert.equal(calls.policies.length, 0);
  assert.equal(calls.complete[0].intent, 'RESTRINGIDA');
});

test('rechaza salarios individuales, incluido el del gerente general', async () => {
  const { agent, calls } = createHarness();
  const response = await agent.answer({
    question: '¿Cuál es el salario del gerente general?',
    userId: USER_ID, role: 'COLABORADOR', requestId: REQUEST_ID
  });
  assert.equal(response.intent, 'RESTRINGIDA');
  assert.equal(response.topic, 'REMUNERACION');
  assert.equal(calls.classify.length, 0);
  assert.equal(calls.personal.length, 0);
});

test('una pregunta mixta ejecuta ambos agentes en paralelo y preserva cifras y citas', async () => {
  let active = 0;
  let peak = 0;
  const harness = createHarness({ result: classification('MIXTA', { topic: 'VACACIONES' }) });
  const gate = new Promise((resolve) => setImmediate(resolve));
  harness.agent = createOrchestratorAgent({
    repository: harness.repository,
    deepSeekService: { generateStructured: async () => ({ data: classification('MIXTA') }) },
    systemPrompt: 'Prompt de prueba.',
    policyAgent: { answer: async (input) => {
      harness.calls.policies.push(input);
      active += 1; peak = Math.max(peak, active); await gate; active -= 1;
      return {
        answer: 'Extracto exacto de política [1].',
        resolution: 'RESPONDIDA',
        citations: [{ reference: 1, title: 'Política', section: 'Acumulación', version: '1.0', link: 'https://drive.google.com/open?id=ficticio' }],
        documentsCited: [{ title: 'Política', version: '1.0' }],
        retrievedFragments: [{ id: CHUNK_ID, similarity: 0.91, cited: true }]
      };
    } },
    personalDataAgent: { answer: async (input) => {
      harness.calls.personal.push(input);
      active += 1; peak = Math.max(peak, active); await gate; active -= 1;
      return { answer: 'Saldo disponible: 12.00 días. Fuente de datos: MySQL.', resolved: true, escalationSuggested: false, escalated: false, citations: [] };
    } }
  });
  const response = await harness.agent.answer({
    question: '¿Cuántos días de vacaciones me quedan y puedo acumularlos?',
    userId: USER_ID, role: 'COLABORADOR', requestId: REQUEST_ID
  });
  assert.equal(peak, 2);
  assert.match(response.answer, /12\.00 días/);
  assert.match(response.answer, /Extracto exacto de política \[1\]/);
  assert.deepEqual(response.citations, [{ reference: 1, title: 'Política', section: 'Acumulación', version: '1.0', link: 'https://drive.google.com/open?id=ficticio' }]);
  assert.deepEqual(response.fragmentsUsed, [{ id: CHUNK_ID, similarity: 0.91, cited: true }]);
  assert.deepEqual(response.agentsUsed, ['POLITICAS', 'DATOS_COLABORADOR']);
  assert.equal(harness.calls.policies[0].persistAudit, false);
  assert.equal(harness.calls.complete[0].agentsUsed.length, 2);
});

test('la política sin evidencia responde sin inventar y registra solo al orquestador', async () => {
  const harness = createHarness({ result: classification('POLITICA', { topic: 'BENEFICIOS' }) });
  harness.agent = createOrchestratorAgent({
    repository: harness.repository,
    systemPrompt: 'Prompt de prueba.',
    deepSeekService: { generateStructured: async () => ({ data: classification('POLITICA', { topic: 'BENEFICIOS' }) }) },
    policyAgent: { answer: async (input) => {
      harness.calls.policies.push(input);
      return { answer: 'No encontré evidencia documental suficiente. Contacta a RRHH.', resolution: 'SIN_EVIDENCIA', citations: [], documentsCited: [], retrievedFragments: [] };
    } },
    personalDataAgent: { answer: async () => { throw new Error('No debe ejecutarse.'); } }
  });
  const response = await harness.agent.answer({
    question: '¿La empresa ofrece un bono para mascotas?',
    userId: USER_ID, role: 'COLABORADOR', requestId: REQUEST_ID
  });
  assert.equal(response.intent, 'POLITICA');
  assert.equal(response.resolved, false);
  assert.match(response.answer, /No encontré evidencia documental suficiente/);
  assert.deepEqual(response.citations, []);
  assert.deepEqual(harness.calls.complete[0].agentsUsed, ['POLITICAS']);
});

test('orienta preguntas fuera de alcance sin delegar a otros agentes', async () => {
  const { agent, calls } = createHarness({ result: classification('FUERA_DE_ALCANCE', { topic: 'OTRO' }) });
  const response = await agent.answer({
    question: '¿Me recomiendas una película?',
    userId: USER_ID, role: 'COLABORADOR', requestId: REQUEST_ID
  });
  assert.match(response.answer, /consultas de Recursos Humanos/);
  assert.deepEqual(response.agentsUsed, []);
  assert.equal(calls.policies.length, 0);
  assert.equal(calls.personal.length, 0);
});

test('valida el rol RRHH en backend para reportes y no llama al analista ausente', async () => {
  const collaborator = createHarness({ result: classification('REPORTE', { topic: 'REPORTES' }) });
  const denied = await collaborator.agent.answer({
    question: 'Genera el reporte diario de RRHH',
    userId: USER_ID, role: 'COLABORADOR', requestId: REQUEST_ID
  });
  assert.equal(denied.intent, 'RESTRINGIDA');
  assert.equal(denied.escalationSuggested, true);

  const hr = createHarness({ result: classification('REPORTE', { topic: 'REPORTES' }) });
  const prepared = await hr.agent.answer({
    question: 'Genera el reporte diario de RRHH',
    userId: '00000000-0000-4000-8000-000000000002', role: 'RRHH', requestId: REQUEST_ID
  });
  assert.equal(prepared.intent, 'REPORTE');
  assert.equal(prepared.resolved, false);
  assert.match(prepared.answer, /fase posterior/);
  assert.deepEqual(prepared.agentsUsed, []);
});

test('solicita aclaración con confianza baja y limita contexto a temas del mismo usuario', async () => {
  const harness = createHarness({
    context: [{ intent: 'POLITICA', topic: 'VACACIONES' }],
    result: classification('POLITICA', { confidence: 0.2, needsClarification: false })
  });
  const response = await harness.agent.answer({
    question: '¿Y puedo acumularlos?',
    userId: USER_ID, role: 'COLABORADOR', requestId: REQUEST_ID,
    conversationId: CONVERSATION_ID
  });
  assert.equal(response.intent, null);
  assert.equal(response.clarificationNeeded, true);
  const modelInput = harness.calls.classify[0].requestBody.messages[1].content;
  assert.match(modelInput, /VACACIONES/);
  assert.doesNotMatch(modelInput, /password|salario|answer|persona|Juan/i);
  assert.equal(harness.calls.contextArgs[0], USER_ID);
  assert.equal(harness.calls.contextArgs[1], CONVERSATION_ID);
});

test('devuelve la respuesta idempotente guardada sin repetir clasificación ni agentes', async () => {
  const cached = { messageId: MESSAGE_ID, conversationId: CONVERSATION_ID, answer: 'Respuesta previa', intent: 'FUERA_DE_ALCANCE' };
  const harness = createHarness();
  harness.repository.reserveMessage = async () => ({ status: 'COMPLETED', response: cached });
  const response = await harness.agent.answer({
    question: '¿Me recomiendas una película?',
    userId: USER_ID, role: 'COLABORADOR', requestId: REQUEST_ID
  });
  assert.equal(response, cached);
  assert.equal(harness.calls.classify.length, 0);
  assert.equal(harness.calls.complete.length, 0);
});

test('serializa las clasificaciones con el cliente DeepSeek existente', async () => {
  const previousKey = process.env.DEEPSEEK_API_KEY;
  const previousModel = process.env.DEEPSEEK_MODEL;
  process.env.DEEPSEEK_API_KEY = 'test-deepseek-key';
  process.env.DEEPSEEK_MODEL = 'test-model';
  let payload;
  const { createDeepSeekService } = require('../src/services/deepseek.service');
  const service = createDeepSeekService({
    fetchImpl: async (_url, options) => {
      payload = JSON.parse(options.body);
      return {
        ok: true, status: 200,
        json: async () => ({ model: 'test-model', choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(classification('MIXTA')) } }] })
      };
    },
    logger: { info() {} }
  });
  try {
    const result = await service.generateStructured({
      messages: [{ role: 'system', content: 'Clasifica.' }, { role: 'user', content: '{"pregunta":"consulta mi saldo y la política"}' }],
      maxTokens: 160
    }, classificationSchema);
    assert.equal(result.data.intent, 'MIXTA');
    assert.equal(payload.model, 'test-model');
    assert.equal(payload.response_format.type, 'json_object');
  } finally {
    if (previousKey === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = previousKey;
    if (previousModel === undefined) delete process.env.DEEPSEEK_MODEL;
    else process.env.DEEPSEEK_MODEL = previousModel;
  }
});

test('rutas de chat usan JWT, validan cuerpos y pasan el mismo usuario a los endpoints de memoria', async () => {
  const users = new Map([
    [USER_ID, { id: USER_ID, email: 'persona1@nexotico.test', rol: 'COLABORADOR', activo: true }],
    [RRHH_ID, { id: RRHH_ID, email: 'rrhh@nexotico.test', rol: 'RRHH', activo: true }]
  ]);
  const received = [];
  const orchestratorAgent = {
    answer: async (input) => { received.push(input); return { messageId: MESSAGE_ID, conversationId: CONVERSATION_ID, answer: 'OK', agent: 'ORQUESTADOR', intent: 'DATO_PERSONAL', topic: 'VACACIONES', agentsUsed: ['DATOS_COLABORADOR'], citations: [], resolved: true, clarificationNeeded: false, escalationSuggested: false, escalated: false, latencyMs: 1 }; },
    getHistory: async (id, options) => ({ owner: id, options }),
    listConversations: async (id, limit) => ({ owner: id, limit }),
    getConversation: async (id, conversationId, limit) => ({ owner: id, conversationId, limit })
  };
  const app = createApp({
    secret: SECRET,
    corsOrigin: 'http://localhost:5173',
    authRepository: { findById: async (id) => users.get(id) || null, findByEmail: async () => null },
    selfRepository: {},
    orchestratorAgent
  });
  const token = jwt.sign({}, SECRET, { subject: USER_ID, expiresIn: '1h' });
  const auth = { Authorization: 'Bearer ' + token };
  assert.equal((await request(app).post('/api/chat').send({ question: 'Mis vacaciones', requestId: REQUEST_ID })).status, 401);
  assert.equal((await request(app).post('/api/chat').set(auth).send({ question: 'Mis vacaciones', requestId: REQUEST_ID, userId: RRHH_ID })).status, 400);
  const sent = await request(app).post('/api/chat').set(auth).send({ question: 'Mis vacaciones', requestId: REQUEST_ID });
  assert.equal(sent.status, 200);
  assert.equal(received[0].userId, USER_ID);
  assert.equal(received[0].role, 'COLABORADOR');
  assert.equal((await request(app).get('/api/chat/history').set(auth)).body.messages.owner, USER_ID);
  assert.equal((await request(app).get('/api/chat/conversations').set(auth)).body.conversations.owner, USER_ID);
  assert.equal((await request(app).get('/api/chat/conversations/' + CONVERSATION_ID).set(auth)).body.conversation.owner, USER_ID);
  assert.equal((await request(app).post('/api/chat/employee-data').set(auth).send({ question: 'Mis vacaciones' })).status, 404);
});
