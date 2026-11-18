'use strict';

const { DataTypes, QueryTypes } = require('sequelize');

const intentValues = ['POLITICA', 'DATO_PERSONAL', 'MIXTA', 'REPORTE', 'RESTRINGIDA', 'FUERA_DE_ALCANCE'];

async function tableExists(queryInterface, tableName) {
  const tables = await queryInterface.showAllTables();
  return tables.some((table) => {
    const name = typeof table === 'string' ? table : table.tableName || Object.values(table)[0];
    return String(name).toLowerCase() === tableName.toLowerCase();
  });
}

async function constraintExists(queryInterface, tableName, constraintName) {
  const rows = await queryInterface.sequelize.query(
    'SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS ' +
    'WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :tableName AND CONSTRAINT_NAME = :constraintName',
    { replacements: { tableName, constraintName }, type: QueryTypes.SELECT }
  );
  return rows.length > 0;
}

async function addForeignKey(queryInterface, tableName, name, field, referencedTable, referencedField) {
  if (await constraintExists(queryInterface, tableName, name)) return;
  await queryInterface.addConstraint(tableName, {
    fields: [field],
    type: 'foreign key',
    name,
    references: { table: referencedTable, field: referencedField },
    onUpdate: 'CASCADE',
    onDelete: 'RESTRICT'
  });
}

async function ensureIndex(queryInterface, tableName, name, fields, unique = false) {
  const indexes = await queryInterface.showIndex(tableName);
  if (!indexes.some((index) => index.name === name)) {
    await queryInterface.addIndex(tableName, fields, { name, unique });
  }
}

module.exports = {
  async up(queryInterface) {
    if (!(await tableExists(queryInterface, 'conversaciones'))) {
      await queryInterface.createTable('conversaciones', {
        id: { type: DataTypes.CHAR(36), primaryKey: true, allowNull: false },
        usuario_id: { type: DataTypes.CHAR(36), allowNull: false },
        titulo: { type: DataTypes.STRING(160), allowNull: false, defaultValue: 'Conversación de RRHH' },
        tema: { type: DataTypes.STRING(80), allowNull: true },
        creado_en: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        actualizado_en: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
      });
    }

    const existing = await queryInterface.describeTable('consultas_chat');
    const columns = {
      conversacion_id: { type: DataTypes.CHAR(36), allowNull: true },
      colaborador_id: { type: DataTypes.CHAR(36), allowNull: true },
      solicitud_idempotencia: { type: DataTypes.CHAR(36), allowNull: true },
      intencion: { type: DataTypes.ENUM(...intentValues), allowNull: true },
      agentes_utilizados: { type: DataTypes.JSON, allowNull: true },
      citas_documentales: { type: DataTypes.JSON, allowNull: true },
      tema: { type: DataTypes.STRING(80), allowNull: true },
      escalamiento_realizado: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      escalamiento_sugerido: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }
    };
    for (const [name, definition] of Object.entries(columns)) {
      if (!existing[name]) await queryInterface.addColumn('consultas_chat', name, definition);
    }

    await addForeignKey(queryInterface, 'conversaciones', 'fk_conversaciones_usuario', 'usuario_id', 'usuarios', 'id');
    await addForeignKey(queryInterface, 'consultas_chat', 'fk_chat_conversacion', 'conversacion_id', 'conversaciones', 'id');
    await addForeignKey(queryInterface, 'consultas_chat', 'fk_chat_colaborador', 'colaborador_id', 'colaboradores', 'id');
    await ensureIndex(queryInterface, 'conversaciones', 'idx_conversaciones_usuario_actualizado', ['usuario_id', 'actualizado_en']);
    await ensureIndex(queryInterface, 'consultas_chat', 'uq_chat_usuario_idempotencia', ['usuario_id', 'solicitud_idempotencia'], true);
    await ensureIndex(queryInterface, 'consultas_chat', 'idx_chat_usuario_conversacion_fecha', ['usuario_id', 'conversacion_id', 'creado_en']);
  },

  async down() {
    throw new Error('La eliminación de conversaciones e historial está deshabilitada; prepare una migración revisada.');
  }
};
