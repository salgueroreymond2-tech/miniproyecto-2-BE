'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const { createApp } = require('../src/app');

const secret = 'test-secret-for-report-routes-123456';
const rrhhId = '00000000-0000-4000-8000-000000000031';
const employeeId = '00000000-0000-4000-8000-000000000032';

function auth(id) { return `Bearer ${jwt.sign({}, secret, { subject: id, expiresIn: '1h' })}`; }

test('endpoints de reportes exigen JWT y rol RRHH, validan fechas y leen el historial almacenado', async () => {
  const calls = [];
  const users = new Map([[rrhhId, { id: rrhhId, rol: 'RRHH', activo: true }], [employeeId, { id: employeeId, rol: 'COLABORADOR', activo: true }]]);
  const agent = {
    latest: async () => ({ reportDate: '2026-11-18' }),
    history: async (limit) => { calls.push(['history', limit]); return [{ reportDate: '2026-11-18' }]; },
    byDate: async (date) => { calls.push(['date', date]); return date === '2026-11-18' ? { reportDate: date } : null; },
    generateDailyReport: async () => { calls.push(['generate']); return { report: { reportDate: '2026-11-18' }, created: false, reused: true }; }
  };
  const app = createApp({ secret, corsOrigin: 'http://localhost:5173', authRepository: { findById: async (id) => users.get(id) || null }, selfRepository: {}, analystAgent: agent });
  assert.equal((await request(app).get('/api/reports/latest')).status, 401);
  assert.equal((await request(app).get('/api/reports/latest').set('Authorization', auth(employeeId))).status, 403);
  const header = { Authorization: auth(rrhhId) };
  assert.deepEqual((await request(app).get('/api/reports/latest').set(header)).body.report, { reportDate: '2026-11-18' });
  assert.equal((await request(app).get('/api/reports/history?limit=366').set(header)).status, 400);
  assert.equal((await request(app).get('/api/reports/history?unexpected=1').set(header)).status, 400);
  assert.equal((await request(app).get('/api/reports/history?limit=5').set(header)).body.reports.length, 1);
  assert.equal((await request(app).get('/api/reports/not-a-date').set(header)).status, 400);
  assert.equal((await request(app).get('/api/reports/2026-11-18').set(header)).status, 200);
  assert.equal((await request(app).post('/api/reports/generate').set(header).send({ date: '2020-01-01' })).status, 400);
  assert.equal((await request(app).post('/api/reports/generate').set(header).send({})).status, 200);
  assert.deepEqual(calls.at(-1), ['generate']);
});
