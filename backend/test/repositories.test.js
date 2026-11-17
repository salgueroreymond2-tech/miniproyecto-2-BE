'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/config/database');
const auth = require('../src/repositories/authRepository');
const self = require('../src/repositories/selfRepository');

test('las consultas separan los datos de entrada del texto SQL', async (context) => {
  const calls = [];
  context.mock.method(db, 'query', async (sql, values) => { calls.push({ sql, values }); return { rows: [] }; });
  const injection = "' OR 1=1 --";
  await auth.findByEmail(injection);
  await auth.findById(injection);
  await self.getProfile(injection);
  await self.getVacations(injection);
  await self.getRequests(injection);
  for (const call of calls) {
    assert.ok(call.sql.includes('$1'));
    assert.equal(call.sql.includes(injection), false);
    assert.deepEqual(call.values, [injection]);
  }
});
