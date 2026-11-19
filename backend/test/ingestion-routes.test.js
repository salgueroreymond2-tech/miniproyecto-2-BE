'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const { createApp } = require('../src/app');

const secret = 'test-secret-for-ingestion-routes-123456';
const rrhhId = '00000000-0000-4000-8000-000000000011';
const collaboratorId = '00000000-0000-4000-8000-000000000012';

function token(id) {
  return jwt.sign({}, secret, { subject: id, expiresIn: '1h' });
}

test('protege endpoints de ingesta para RRHH y valida la aprobación legal', async () => {
  const approved = [];
  const agent = {
    listCandidates: async () => [{ driveFileId: 'file-1', status: 'PENDIENTE_VALIDACION_NORMATIVA' }],
    approveCandidate: async (input) => { approved.push(input); return { status: 'APROBADO' }; },
    pilot: async () => ({ indexed: 1 }),
    sync: async () => ({ indexed: 2 }),
    status: async () => ({ configured: true })
  };
  const users = {
    [rrhhId]: { id: rrhhId, rol: 'RRHH', activo: true },
    [collaboratorId]: { id: collaboratorId, rol: 'COLABORADOR', activo: true }
  };
  const app = createApp({
    secret,
    corsOrigin: 'http://localhost:5173',
    authRepository: { findById: async (id) => users[id] || null },
    selfRepository: {},
    ingestionAgent: agent
  });
  const route = '/api/admin/ingestion';
  assert.equal((await request(app).get(`${route}/status`)).status, 401);
  assert.equal((await request(app).get(`${route}/status`).set('Authorization', `Bearer ${token(collaboratorId)}`)).status, 403);
  assert.equal((await request(app).get(`${route}/candidates`).set('Authorization', `Bearer ${token(rrhhId)}`)).status, 200);
  assert.equal((await request(app).post(`${route}/approvals`).set('Authorization', `Bearer ${token(rrhhId)}`).send({
    driveFileId: 'file-1',
    contentHash: 'invalid',
    category: 'POLITICA',
    legalSources: ['https://www.mtss.go.cr/temas-laborales/'],
    reviewedNoPersonalData: true,
    reviewedNormativeContent: true
  })).status, 400);
  const response = await request(app).post(`${route}/approvals`)
    .set('Authorization', `Bearer ${token(rrhhId)}`)
    .send({
      driveFileId: 'file-1',
      contentHash: 'a'.repeat(64),
      category: 'POLITICA',
      legalSources: ['https://www.mtss.go.cr/temas-laborales/'],
      reviewedNoPersonalData: true,
      reviewedNormativeContent: true
    });
  assert.equal(response.status, 201);
  assert.equal(approved[0].reviewerId, rrhhId);
  assert.equal((await request(app).post(`${route}/pilot`).set('Authorization', `Bearer ${token(rrhhId)}`).send({ driveFileId: 'file-1' })).status, 200);
  assert.equal((await request(app).post(`${route}/pilot`).set('Authorization', `Bearer ${token(rrhhId)}`).send({ extra: true })).status, 400);

  agent.sync = async () => { throw Object.assign(new Error('EACCES: private runtime detail'), { code: 'EACCES' }); };
  const unavailable = await request(app).post(`${route}/sync`).set('Authorization', `Bearer ${token(rrhhId)}`).send({});
  assert.equal(unavailable.status, 503);
  assert.match(unavailable.body.error, /Google Drive/);
  assert.doesNotMatch(unavailable.body.error, /private runtime detail/);

  agent.sync = async () => { throw Object.assign(new Error('Ejecute primero el piloto.'), { code: 'PILOT_REQUIRED' }); };
  const pilotRequired = await request(app).post(`${route}/sync`).set('Authorization', `Bearer ${token(rrhhId)}`).send({});
  assert.equal(pilotRequired.status, 409);
  assert.match(pilotRequired.body.error, /piloto/);
});
