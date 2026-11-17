'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

delete process.env.DATABASE_URL;

const database = require('../src/config/database');

test('el pool permanece sin crear cuando DATABASE_URL no existe', async () => {
  assert.equal(database.databaseIsConfigured(), false);
  assert.deepEqual(await database.checkDatabaseConnection(), {
    configured: false,
    connected: false,
    reason: 'DATABASE_URL no configurada'
  });
});

test('una consulta sin configuración informa el error esperado', async () => {
  await assert.rejects(
    database.query('SELECT $1::int', [1]),
    { code: 'DATABASE_NOT_CONFIGURED' }
  );
});
