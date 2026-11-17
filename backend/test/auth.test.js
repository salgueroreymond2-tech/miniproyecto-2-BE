'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const { createApp } = require('../src/app');

const secret = 'test-secret-for-nexotico-only-123456789';
const users = [
  { id: '00000000-0000-4000-8000-000000000001', email: 'colaborador@example.test', rol: 'COLABORADOR', activo: true },
  { id: '00000000-0000-4000-8000-000000000002', email: 'rrhh@example.test', rol: 'RRHH', activo: true }
];

async function fixture() {
  const hash = await bcrypt.hash('ContrasenaDePrueba123', 4);
  const repository = {
    findByEmail: async (email) => { const user = users.find((item) => item.email === email); return user ? { ...user, password_hash: hash } : null; },
    findById: async (id) => users.find((item) => item.id === id) || null
  };
  const seen = [];
  const selfRepository = {
    getProfile: async (id) => { seen.push(id); return { codigo: id === users[0].id ? 'NTC-001' : 'NTC-002' }; },
    getVacations: async (id) => { seen.push(id); return [{ periodo_anual: 2026 }]; },
    getRequests: async (id) => { seen.push(id); return []; },
    getNextPayday: async () => null,
    listEmployees: async () => [{ codigo: 'NTC-001' }]
  };
  return { app: createApp({ secret, corsOrigin: 'http://localhost:5173', authRepository: repository, selfRepository }), seen };
}

async function login(app, email = users[0].email, password = 'ContrasenaDePrueba123') {
  return request(app).post('/api/auth/login').send({ email, password });
}

test('credenciales correctas e incorrectas, con respuesta sin hash', async () => {
  const { app } = await fixture();
  const ok = await login(app);
  assert.equal(ok.status, 200);
  assert.ok(ok.body.token);
  assert.equal(JSON.stringify(ok.body).includes('password_hash'), false);
  assert.equal((await login(app, users[0].email, 'incorrecta')).status, 401);
  assert.equal((await login(app, 'ausente@example.test')).status, 401);
});

test('sin autenticación, tokens inválidos, vencidos y usuario desactivado', async () => {
  const { app } = await fixture();
  assert.equal((await request(app).get('/api/auth/me')).status, 401);
  assert.equal((await request(app).get('/api/auth/me').set('Authorization', 'Bearer alterado')).status, 401);
  const expired = jwt.sign({}, secret, { subject: users[0].id, expiresIn: -1 });
  assert.equal((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${expired}`)).status, 401);
  const unknown = jwt.sign({}, secret, { subject: '00000000-0000-4000-8000-000000000099', expiresIn: '1h' });
  assert.equal((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${unknown}`)).status, 401);
  const valid = jwt.sign({}, secret, { subject: users[0].id, expiresIn: '1h' });
  users[0].activo = false;
  try {
    assert.equal((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${valid}`)).status, 401);
  } finally { users[0].activo = true; }
});

test('roles y datos propios sin permitir seleccionar otro colaborador', async () => {
  const { app, seen } = await fixture();
  const employeeToken = (await login(app)).body.token;
  const employee = (path) => request(app).get(path).set('Authorization', `Bearer ${employeeToken}`);
  assert.equal((await employee('/api/colaboradores')).status, 403);
  assert.equal((await employee('/api/colaboradores/me')).body.colaborador.codigo, 'NTC-001');
  assert.equal((await employee('/api/colaboradores/me/vacaciones')).status, 200);
  assert.equal((await employee('/api/colaboradores/me/solicitudes')).status, 200);
  assert.equal((await employee('/api/colaboradores/me/proximo-pago')).status, 200);
  assert.equal((await employee(`/api/colaboradores/me?colaboradorId=${users[1].id}`)).status, 400);
  assert.equal((await employee(`/api/colaboradores/${users[1].id}`)).status, 404);
  assert.ok(seen.every((id) => id === users[0].id));
  const hrToken = (await login(app, users[1].email)).body.token;
  assert.equal((await request(app).get('/api/colaboradores').set('Authorization', `Bearer ${hrToken}`)).status, 200);
});

test('entradas inválidas, inyección y límite de intentos', async () => {
  const { app } = await fixture();
  assert.equal((await request(app).post('/api/auth/login').send({ email: "' OR 1=1 --", password: 'x' })).status, 400);
  assert.equal((await request(app).post('/api/auth/login').send({ email: users[0].email, password: 'x', rol: 'RRHH' })).status, 400);
  for (let i = 0; i < 3; i += 1) assert.equal((await login(app, users[0].email, 'incorrecta')).status, 401);
  assert.equal((await login(app)).status, 429);
});

test('CORS solo autoriza el origen configurado', async () => {
  const { app } = await fixture();
  assert.equal((await request(app).get('/api/health').set('Origin', 'http://localhost:5173')).headers['access-control-allow-origin'], 'http://localhost:5173');
  assert.notEqual((await request(app).get('/api/health').set('Origin', 'https://example.test')).headers['access-control-allow-origin'], 'https://example.test');
});
