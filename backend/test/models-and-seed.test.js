'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { Sequelize } = require('sequelize');
const { initModels } = require('../src/models');
const seed = require('../seeders/20261117000200-demo-data');

test('se registran los 19 modelos y relaciones solicitadas sin conexión', async () => {
  const sequelize = new Sequelize('demo', 'demo', 'demo', { dialect: 'mysql', logging: false });
  try {
    const m = initModels(sequelize);
    assert.equal(Object.keys(m).length, 19);
    assert.equal(m.Usuario.associations.Colaborador.associationType, 'HasOne');
    assert.equal(m.Colaborador.associations.Solicituds.associationType, 'HasMany');
    assert.equal(m.Solicitud.associations.Colaborador.associationType, 'BelongsTo');
    assert.equal(m.DocumentChunk.associations.Documento.associationType, 'BelongsTo');
    assert.deepEqual(Object.keys(m.ConsultaChat.rawAttributes).filter((name) => (
      ['resolucion', 'latencia_ms', 'fragmentos_utilizados', 'documentos_citados'].includes(name)
    )).sort(), ['documentos_citados', 'fragmentos_utilizados', 'latencia_ms', 'resolucion']);
    assert.equal(m.IngestionApproval.rawAttributes.normative_reviewed.type.key, 'BOOLEAN');
  } finally { await sequelize.close(); }
});

test('el seeder prepara 50 usuarios y colaboradores con relaciones coherentes', async () => {
  const original = process.env.DEMO_PASSWORD;
  process.env.DEMO_PASSWORD = 'contraseña-ficticia-123';
  const tables = {};
  const tx = { commit: async () => {}, rollback: async () => {} };
  const qi = { sequelize: { transaction: async () => tx }, bulkInsert: async (name, rows) => { tables[name] = rows; } };
  try {
    await seed.up(qi);
    assert.equal(tables.usuarios.length, 50); assert.equal(tables.colaboradores.length, 50);
    assert.equal(tables.departamentos.length, 6); assert.equal(tables.puestos.length, 12);
    assert.ok(tables.usuarios.every((u) => u.password_hash.startsWith('$2')));
    assert.equal(new Set(tables.colaboradores.map((e) => e.usuario_id)).size, 50);
    assert.ok(tables.colaboradores.every((e) => /^\d{4}-\d{2}-\d{2}$/.test(e.fecha_ingreso)));
    assert.deepEqual(new Set(tables.solicitudes.map((s) => s.estado)), new Set(['PENDIENTE', 'APROBADA', 'RECHAZADA']));
  } finally { if (original === undefined) delete process.env.DEMO_PASSWORD; else process.env.DEMO_PASSWORD = original; }
});
