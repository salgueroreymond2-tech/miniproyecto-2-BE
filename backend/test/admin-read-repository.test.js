'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createAdminReadRepository } = require('../src/repositories/adminReadRepository');

test('aplica filtros mediante parámetros y orden seguro a solicitudes administrativas', async () => {
  const calls = [];
  const connection = { query: async (sql, options) => { calls.push({ sql, options }); return sql.includes('COUNT(*)') ? [{ total: 1 }] : [{ id: 'request-id', status: 'PENDIENTE' }]; } };
  const repository = createAdminReadRepository({ connectionFactory: () => connection });
  const result = await repository.listRequests({ page: 2, pageSize: 10, status: 'PENDIENTE', department: 'Tecnología', search: "x' OR 1=1", sortBy: 'EMPLOYEE', direction: 'ASC' });
  assert.equal(result.pagination.total, 1);
  assert.ok(calls.every((call) => call.options.replacements.search === "%x' OR 1=1%"));
  assert.ok(calls.some((call) => /ORDER BY c\.apellidos ASC/.test(call.sql)));
  assert.ok(calls.every((call) => !call.sql.includes("x' OR 1=1")));
});

test('solo lista documentos con chunks E5 activos y documentos sin contenido no aparecen', async () => {
  const calls = [];
  const connection = { query: async (sql) => { calls.push(sql); return sql.includes('SELECT COUNT(DISTINCT d.id)') ? [{ total: 1 }] : [{ driveFileId: 'drive-file', fragmentCount: 4 }]; } };
  const repository = createAdminReadRepository({ connectionFactory: () => connection });
  const result = await repository.listIndexedDocuments({ page: 1, pageSize: 20, search: 'Vacaciones' });
  assert.equal(result.items[0].fragmentCount, 4);
  assert.ok(calls.every((sql) => sql.includes("d.estado = 'VALIDADO'") && sql.includes("c.is_active = 1") && sql.includes("c.validation_status = 'VALIDADO'")));
});
