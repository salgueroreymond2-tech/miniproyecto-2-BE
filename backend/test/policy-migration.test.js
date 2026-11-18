'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const migration = require('../migrations/20261117000700-add-policy-agent-audit');

test('añade únicamente los campos de auditoría que faltan', async () => {
  const added = [];
  await migration.up({
    describeTable: async () => ({ id: {}, pregunta: {}, respuesta: {} }),
    addColumn: async (table, name, definition) => added.push({ table, name, definition })
  });
  assert.deepEqual(added.map(({ name }) => name), [
    'resolucion', 'latencia_ms', 'fragmentos_utilizados', 'documentos_citados'
  ]);
  assert.ok(added.every(({ table }) => table === 'consultas_chat'));
});

test('no duplica campos que ya existen en el esquema inicial', async () => {
  let additions = 0;
  await migration.up({
    describeTable: async () => ({
      resolucion: {}, latencia_ms: {}, fragmentos_utilizados: {}, documentos_citados: {}
    }),
    addColumn: async () => { additions += 1; }
  });
  assert.equal(additions, 0);
});
