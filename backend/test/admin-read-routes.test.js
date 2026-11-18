'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const { createApp } = require('../src/app');

const secret = 'test-secret-for-admin-read-routes-123456';
const rrhhId = '00000000-0000-4000-8000-000000000041';
const employeeId = '00000000-0000-4000-8000-000000000042';
const auth = (id) => `Bearer ${jwt.sign({}, secret, { subject: id, expiresIn: '1h' })}`;

test('limita consultas administrativas a RRHH y valida filtros y paginación', async () => {
  const called = [];
  const users = new Map([[rrhhId, { id: rrhhId, rol: 'RRHH', activo: true }], [employeeId, { id: employeeId, rol: 'COLABORADOR', activo: true }]]);
  const repository = {
    listDepartments: async () => { called.push('departments'); return [{ name: 'Tecnología', collaborators: 3, activeCollaborators: 2 }]; },
    listRequests: async (query) => { called.push(query); return { items: [], pagination: { page: query.page, pageSize: query.pageSize, total: 0, totalPages: 0 } }; },
    listIndexedDocuments: async (query) => { called.push(query); return { items: [], pagination: { page: query.page, pageSize: query.pageSize, total: 0, totalPages: 0 } }; },
    listSynchronizations: async (query) => { called.push(query); return { items: [], pagination: { page: query.page, pageSize: query.pageSize, total: 0, totalPages: 0 } }; }
  };
  const app = createApp({ secret, corsOrigin: 'http://localhost:5173', authRepository: { findById: async (id) => users.get(id) || null }, selfRepository: {}, adminReadRepository: repository });
  assert.equal((await request(app).get('/api/admin/departments')).status, 401);
  assert.equal((await request(app).get('/api/admin/documents').set('Authorization', auth(employeeId))).status, 403);
  const header = { Authorization: auth(rrhhId) };
  assert.equal((await request(app).get('/api/admin/departments').set(header)).body.departments.length, 1);
  const requests = await request(app).get('/api/admin/requests?page=2&pageSize=25&status=PENDIENTE&search=Ana').set(header);
  assert.equal(requests.status, 200);
  assert.deepEqual(called.find((item) => item?.page === 2), { page: 2, pageSize: 25, status: 'PENDIENTE', search: 'Ana', sortBy: 'CREATED_AT', direction: 'DESC' });
  assert.equal((await request(app).get('/api/admin/requests?pageSize=201').set(header)).status, 400);
  assert.equal((await request(app).get('/api/admin/requests?sortBy=salary_base').set(header)).status, 400);
  assert.equal((await request(app).get('/api/admin/documents?status=ELIMINADO').set(header)).status, 400);
  assert.equal((await request(app).get('/api/admin/synchronizations?offset=1').set(header)).status, 400);
  assert.equal((await request(app).get('/api/admin/documents?page=1').set(header)).status, 200);
  assert.equal((await request(app).get('/api/admin/synchronizations?page=1').set(header)).status, 200);
});
