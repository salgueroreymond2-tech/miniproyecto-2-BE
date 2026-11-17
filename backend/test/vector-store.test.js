'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const store = require('../src/services/vector-store.service');
test('acepta únicamente vectores válidos de 768 dimensiones y modelo fijado', () => {
  assert.equal(store.vector.safeParse(Array(768).fill(1)).success, true);
  assert.equal(store.vector.safeParse(Array(767).fill(1)).success, false);
  assert.equal(store.vector.safeParse(Array(768).fill(0)).success, false);
  assert.equal(store.chunkSchema.safeParse({ embedding_model: 'otro-modelo' }).success, false);
});
test('sin credenciales no se establece conexión a Supabase', async () => {
  await assert.rejects(store.checkConnection(), { code: 'SUPABASE_NOT_CONFIGURED' });
});
