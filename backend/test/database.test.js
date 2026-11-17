'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
delete process.env.DB_USER; delete process.env.DB_PASSWORD;
const database = require('../src/config/database');
test('sin credenciales MySQL no se abre conexión y se informa claramente', async () => {
  assert.equal(database.databaseIsConfigured(), false);
  assert.deepEqual(await database.checkDatabaseConnection(), { configured: false, connected: false, reason: 'Credenciales MySQL no configuradas' });
  assert.throws(() => database.getConnection(), { code: 'DATABASE_NOT_CONFIGURED' });
});
test('la conexión de solo lectura nunca usa las credenciales de escritura', () => {
  assert.throws(() => database.getReadConnection(), { code: 'DATABASE_NOT_CONFIGURED' });
});
