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
test('calcula similitud coseno sin necesidad de una base vectorial externa', () => {
  const first = Array(768).fill(0); first[0] = 1;
  const equal = Array(768).fill(0); equal[0] = 2;
  const perpendicular = Array(768).fill(0); perpendicular[1] = 1;
  assert.equal(store.similarity(first, equal), 1);
  assert.equal(store.similarity(first, perpendicular), 0);
});
