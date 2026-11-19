'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const migration = require('../migrations/20261119000100-create-keywords');
const { KEYWORD_SEEDS, upsertKeywords } = require('../seeders/20261119000100-seed-keywords');
const { matchingKeyword, matchingKeywordsByCategory, normalizeKeywordText } = require('../src/utils/keywordMatcher');

test('normaliza acentos, respeta frases completas y prefiere el término más específico', () => {
  const records = [
    { id: 1, palabra: 'vacaciones', categoria: 'politica', tema_asociado: 'VACACIONES' },
    { id: 2, palabra: 'vacaciones de', categoria: 'restringida', tema_asociado: 'VACACIONES' }
  ];
  assert.equal(normalizeKeywordText('Compañía y evaluación'), 'compania y evaluacion');
  assert.equal(matchingKeyword('¿Qué vacaciones de mi compañero?', records).id, 2);
  assert.equal(matchingKeywordsByCategory('vacacionario', records).length, 0);
});

test('el seeder incluye al menos 45 términos únicos, minúsculos y categorizados', () => {
  assert.ok(KEYWORD_SEEDS.length >= 45);
  const identities = KEYWORD_SEEDS.map((row) => `${row.categoria}\u0000${row.palabra}`);
  assert.equal(new Set(identities).size, KEYWORD_SEEDS.length);
  assert.ok(KEYWORD_SEEDS.every((row) => row.palabra === row.palabra.toLowerCase()));
  assert.deepEqual(new Set(KEYWORD_SEEDS.map((row) => row.categoria)), new Set(['restringida', 'fuera_alcance', 'politica', 'dato_personal', 'tema_dashboard']));
});

test('el seeder usa upsert idempotente y no duplica registros en ejecuciones repetidas', async () => {
  const records = new Map();
  let creates = 0;
  const model = {
    upsert: async (row, options) => {
      assert.equal(options.transaction, transaction);
      const key = `${row.categoria}\u0000${row.palabra}`;
      if (!records.has(key)) creates += 1;
      records.set(key, { ...row });
    }
  };
  const transaction = {};
  await upsertKeywords(model, transaction);
  const count = records.size;
  await upsertKeywords(model, transaction);
  assert.equal(count, KEYWORD_SEEDS.length);
  assert.equal(records.size, count);
  assert.equal(creates, count);
});

test('la migración crea la tabla e índices una sola vez al repetirse', async () => {
  const tables = [];
  const indexes = [];
  const createdTables = [];
  const addedIndexes = [];
  const queryInterface = {
    showAllTables: async () => tables,
    createTable: async (name, columns) => { tables.push(name); createdTables.push({ name, columns }); },
    showIndex: async () => indexes,
    addIndex: async (_table, fields, options) => { indexes.push({ name: options.name }); addedIndexes.push({ fields, ...options }); }
  };
  await migration.up(queryInterface);
  await migration.up(queryInterface);
  assert.equal(createdTables.length, 1);
  assert.equal(createdTables[0].columns.id.autoIncrement, true);
  assert.deepEqual(addedIndexes.find((item) => item.unique).fields, ['palabra', 'categoria']);
  assert.equal(addedIndexes.length, 2);
});
