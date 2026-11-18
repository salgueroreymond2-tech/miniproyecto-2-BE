'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const migration = require('../migrations/20261118000200-create-scheduled-job-runs');

test('crea el registro idempotente de tareas e índices de reporte', async () => {
  const created = [];
  const indexes = [];
  await migration.up({
    showAllTables: async () => [],
    createTable: async (table, columns) => created.push({ table, columns }),
    showIndex: async () => [],
    addIndex: async (table, fields, options) => indexes.push({ table, fields, ...options })
  });
  assert.equal(created[0].table, 'trabajos_programados');
  assert.equal(created[0].columns.clave_ejecucion.unique, true);
  assert.ok(indexes.some((index) => index.name === 'idx_chat_reporte_resolucion'));
  assert.ok(indexes.some((index) => index.name === 'idx_solicitudes_estado_periodo'));
});

test('puede reintentarse sin recrear la tabla ni duplicar índices ya presentes', async () => {
  let creates = 0;
  let additions = 0;
  const names = ['idx_trabajos_tarea_inicio', 'idx_solicitudes_estado_creado', 'idx_solicitudes_estado_periodo', 'idx_incapacidad_estado_periodo', 'idx_movimiento_reporte', 'idx_chat_reporte_resolucion', 'idx_chat_reporte_intencion'];
  await migration.up({
    showAllTables: async () => ['trabajos_programados'],
    createTable: async () => { creates += 1; },
    showIndex: async () => names.map((name) => ({ name })),
    addIndex: async () => { additions += 1; }
  });
  assert.equal(creates, 0);
  assert.equal(additions, 0);
});
