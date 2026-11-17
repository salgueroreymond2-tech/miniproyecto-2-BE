'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/config/database');
const auth = require('../src/repositories/authRepository');
const self = require('../src/repositories/selfRepository');
test('los repositorios envían datos no confiables como parámetros bind', async (t) => {
  const calls = [];
  t.mock.method(db, 'getConnection', () => ({ query: async (sql, options) => { calls.push({ sql, options }); return []; } }));
  const injection = "' OR 1=1 --";
  await auth.findByEmail(injection); await auth.findById(injection); await self.getProfile(injection); await self.getVacations(injection); await self.getRequests(injection);
  for (const call of calls) {
    assert.equal(call.sql.includes(injection), false);
    assert.ok(Object.values(call.options.bind).includes(injection));
  }
});
