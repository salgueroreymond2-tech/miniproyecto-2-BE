'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createAdminReadRepository } = require('../src/repositories/adminReadRepository');

test('filtra, ordena y pagina solicitudes usando modelos Sequelize', async () => {
  let options;
  const rows = [
    { id: '2', tipo: 'VACACIONES', fecha_inicio: '2026-11-20', fecha_fin: '2026-11-22', dias_solicitados: 3, estado: 'PENDIENTE', creado_en: '2026-11-17 10:00:00', Colaborador: { codigo: 'NX002', nombres: 'Ana', apellidos: 'Zamora', Departamento: { nombre: 'Tecnologia' } } },
    { id: '1', tipo: 'PERMISO_PERSONAL', fecha_inicio: '2026-11-19', fecha_fin: '2026-11-19', dias_solicitados: 1, estado: 'PENDIENTE', creado_en: '2026-11-16 10:00:00', Colaborador: { codigo: 'NX001', nombres: 'Luis', apellidos: 'Alfaro', Departamento: { nombre: 'Finanzas' } } }
  ];
  const repository = createAdminReadRepository({ connectionFactory: () => ({}), modelsFactory: () => ({ Solicitud: { findAll: async (value) => { options = value; return rows; } } }) });
  const result = await repository.listRequests({ page: 1, pageSize: 10, status: 'PENDIENTE', department: 'Tecnologia', search: "x' OR 1=1", sortBy: 'EMPLOYEE', direction: 'ASC' });
  assert.equal(result.pagination.total, 0);
  assert.equal(options.where.estado, 'PENDIENTE');
  assert.deepEqual(options.attributes, ['id', 'tipo', 'fecha_inicio', 'fecha_fin', 'dias_solicitados', 'estado', 'creado_en']);
  const filtered = await repository.listRequests({ page: 1, pageSize: 10, department: 'Tecnologia', sortBy: 'EMPLOYEE', direction: 'ASC' });
  assert.equal(filtered.items.length, 1);
  assert.equal(filtered.items[0].code, 'NX002');
});

test('agrupa solo fragmentos activos y validados y evita leer contenido o embeddings', async () => {
  let options;
  const repository = createAdminReadRepository({ connectionFactory: () => ({}), modelsFactory: () => ({ DocumentChunk: { findAll: async (value) => {
    options = value;
    return [1, 2].map((id) => ({ id: `chunk-${id}`, document_id: 'doc', category: 'POLITICA', source_url: 'https://drive.google.com/file/d/doc', created_at: `2026-11-1${id}`, Documento: { id: 'doc', drive_file_id: 'drive-file', titulo: 'Vacaciones', version: '1.0', estado: 'VALIDADO' } }));
  } } }) });
  const result = await repository.listIndexedDocuments({ page: 1, pageSize: 20, search: 'Vacaciones' });
  assert.equal(result.items[0].fragmentCount, 2);
  assert.deepEqual(options.where, { is_active: true, validation_status: 'VALIDADO' });
  assert.ok(!options.attributes.includes('content') && !options.attributes.includes('embedding'));
  assert.equal(result.items[0].driveFileId, 'drive-file');
});

test('consulta departamentos y sincronizaciones mediante sus modelos Sequelize', async () => {
  const repository = createAdminReadRepository({ connectionFactory: () => ({}), modelsFactory: () => ({
    Departamento: { findAll: async () => [
      { id: 'd1', nombre: 'Tecnologia', Colaborador: { id: 'c1', estado: 'ACTIVO' } },
      { id: 'd1', nombre: 'Tecnologia', Colaborador: { id: 'c2', estado: 'INACTIVO' } }
    ] },
    Sincronizacion: { findAndCountAll: async () => ({ count: 1, rows: [{ id: 's1', origen: 'GOOGLE_DRIVE', estado: 'COMPLETADA', inicio_en: '2026-11-18', finalizo_en: '2026-11-18', documentos_leidos: 1, documentos_actualizados: 1 }] }) }
  }) });
  assert.deepEqual(await repository.listDepartments(), [{ id: 'd1', name: 'Tecnologia', collaborators: 2, activeCollaborators: 1 }]);
  const sync = await repository.listSynchronizations({ page: 1, pageSize: 10 });
  assert.equal(sync.items[0].documentsUpdated, 1);
  assert.equal(sync.items[0].source, 'GOOGLE_DRIVE');
  assert.equal(sync.pagination.total, 1);
});
