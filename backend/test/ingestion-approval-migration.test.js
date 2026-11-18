'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const migration = require('../migrations/20261117000800-require-normative-review');

test('agrega la atestación de revisión normativa sin modificar registros previos', async () => {
  const additions = [];
  await migration.up({
    describeTable: async () => ({ id: {}, content_hash: {}, data_reviewed: {} }),
    addColumn: async (table, name, definition) => additions.push({ table, name, definition })
  });
  assert.equal(additions.length, 1);
  assert.equal(additions[0].table, 'ingestion_approvals');
  assert.equal(additions[0].name, 'normative_reviewed');
  assert.equal(additions[0].definition.allowNull, false);
  assert.equal(additions[0].definition.defaultValue, false);
});

test('no intenta duplicar la atestación si la migración ya se aplicó', async () => {
  let additions = 0;
  await migration.up({
    describeTable: async () => ({ normative_reviewed: {} }),
    addColumn: async () => { additions += 1; }
  });
  assert.equal(additions, 0);
});
