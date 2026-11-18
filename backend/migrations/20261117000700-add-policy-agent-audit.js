'use strict';

const { DataTypes } = require('sequelize');

module.exports = {
  async up(queryInterface) {
    const existing = await queryInterface.describeTable('consultas_chat');
    const columns = {
      resolucion: { type: DataTypes.ENUM('RESPONDIDA', 'SIN_EVIDENCIA', 'ERROR'), allowNull: true },
      latencia_ms: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      fragmentos_utilizados: { type: DataTypes.JSON, allowNull: true },
      documentos_citados: { type: DataTypes.JSON, allowNull: true }
    };
    for (const [name, definition] of Object.entries(columns)) {
      if (!existing[name]) await queryInterface.addColumn('consultas_chat', name, definition);
    }
  },
  async down() {
    throw new Error('La eliminación del historial de consultas está deshabilitada; prepare una migración revisada.');
  }
};
