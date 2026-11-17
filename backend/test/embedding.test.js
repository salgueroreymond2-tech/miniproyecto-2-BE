'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createEmbeddingService } = require('../src/services/embedding.service');

test('calienta una vez, reutiliza la carga concurrente y aplica prefijos y pooling', async () => {
  const calls = [];
  let loads = 0;
  const service = createEmbeddingService({ loadPipeline: async () => {
    loads += 1;
    return async (text, options) => { calls.push({ text, options }); const data = Array(384).fill(0); data[0] = 1; return { data }; };
  } });
  const [question, passage] = await Promise.all([
    service.createEmbedding('¿Vacaciones?', 'RETRIEVAL_QUERY'),
    service.createEmbedding('Una política.', 'RETRIEVAL_DOCUMENT')
  ]);
  assert.equal(loads, 1);
  assert.equal(calls.filter((call) => call.text === 'query: calentamiento').length, 1);
  assert.equal(calls.some((call) => call.text === 'query: ¿Vacaciones?'), true);
  assert.equal(calls.some((call) => call.text === 'passage: Una política.'), true);
  assert.ok(calls.every((call) => call.options.pooling === 'mean' && call.options.normalize === true));
  assert.equal(question.length, 384); assert.equal(passage.length, 384);
});

test('permite reintentar la carga si el modelo falla', async () => {
  let attempts = 0;
  const service = createEmbeddingService({ loadPipeline: async () => {
    if (++attempts === 1) throw new Error('fallo de carga');
    return async () => { const data = Array(384).fill(0); data[0] = 1; return { data }; };
  } });
  await assert.rejects(service.warmUpEmbeddings(), /fallo de carga/);
  assert.equal((await service.createEmbedding('texto')).length, 384);
  assert.equal(attempts, 2);
});
