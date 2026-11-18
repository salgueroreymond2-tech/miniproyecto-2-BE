'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createEmbeddingService } = require('../src/services/embedding.service');

test('calienta una vez, reutiliza la carga concurrente y aplica prefijos y pooling', async () => {
  const calls = [];
  let loads = 0;
  const service = createEmbeddingService({ loadPipeline: async () => {
    loads += 1;
    const extractor = async (text, options) => { calls.push({ text, options }); const data = Array(384).fill(0); data[0] = 1; return { data }; };
    extractor.tokenizer = { encode: (text, options) => [...String(text).matchAll(/\S+/gu)].map((_item, index) => index + 1).concat(options?.add_special_tokens === false ? [] : [0, 0]) };
    return extractor;
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
  assert.ok(calls.every((call) => call.options.truncation === undefined));
  assert.equal(question.length, 384); assert.equal(passage.length, 384);
});

test('permite reintentar la carga si el modelo falla', async () => {
  let attempts = 0;
  const service = createEmbeddingService({ loadPipeline: async () => {
    if (++attempts === 1) throw new Error('fallo de carga');
    const extractor = async () => { const data = Array(384).fill(0); data[0] = 1; return { data }; };
    extractor.tokenizer = { encode: (text) => [...String(text).matchAll(/\S+/gu)].map((_item, index) => index + 1) };
    return extractor;
  } });
  await assert.rejects(service.warmUpEmbeddings(), /fallo de carga/);
  assert.equal((await service.createEmbedding('texto')).length, 384);
  assert.equal(attempts, 2);
});

test('rechaza una entrada que excede 512 tokens contando el prefijo y tokens especiales', async () => {
  let inferenceCalls = 0;
  const service = createEmbeddingService({ loadPipeline: async () => {
    const extractor = async () => { inferenceCalls += 1; return { data: [1, ...Array(383).fill(0)] }; };
    extractor.tokenizer = { encode: (text, options) => {
      const ids = [...String(text).matchAll(/\S+/gu)].map((_item, index) => index + 1);
      return options?.add_special_tokens === false ? ids : [0, ...ids, 0];
    } };
    return extractor;
  } });
  await assert.rejects(service.createEmbedding(Array(511).fill('token').join(' ')), { code: 'EMBEDDING_TOKEN_LIMIT' });
  assert.equal(inferenceCalls, 1); // Solo se ejecuta el calentamiento, nunca la entrada demasiado larga.
});
