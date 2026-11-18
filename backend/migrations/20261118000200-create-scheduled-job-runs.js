'use strict';

const { DataTypes } = require('sequelize');

async function ensureIndex(queryInterface, table, name, fields) {
  const indexes = await queryInterface.showIndex(table);
  if (!indexes.some((index) => index.name === name)) await queryInterface.addIndex(table, fields, { name });
}

module.exports = {
  async up(queryInterface) {
    const tables = await queryInterface.showAllTables();
    const exists = tables.some((table) => String(typeof table === 'string' ? table : table.tableName || Object.values(table)[0]).toLowerCase() === 'trabajos_programados');
    if (!exists) {
      await queryInterface.createTable('trabajos_programados', {
        id: { type: DataTypes.CHAR(36), primaryKey: true, allowNull: false },
        clave_ejecucion: { type: DataTypes.STRING(120), allowNull: false, unique: true },
        tarea: { type: DataTypes.STRING(60), allowNull: false },
        estado: { type: DataTypes.ENUM('EN_PROCESO', 'COMPLETADO', 'FALLIDO'), allowNull: false },
        inicio_en: { type: DataTypes.DATE, allowNull: false },
        finalizo_en: { type: DataTypes.DATE, allowNull: true },
        resultado: { type: DataTypes.JSON, allowNull: true },
        error_codigo: { type: DataTypes.STRING(120), allowNull: true }
      });
    }
    await ensureIndex(queryInterface, 'trabajos_programados', 'idx_trabajos_tarea_inicio', ['tarea', 'inicio_en']);
    await ensureIndex(queryInterface, 'solicitudes', 'idx_solicitudes_estado_creado', ['estado', 'creado_en']);
    await ensureIndex(queryInterface, 'solicitudes', 'idx_solicitudes_estado_periodo', ['estado', 'fecha_inicio', 'fecha_fin']);
    await ensureIndex(queryInterface, 'incapacidades', 'idx_incapacidad_estado_periodo', ['estado', 'fecha_inicio', 'fecha_fin']);
    await ensureIndex(queryInterface, 'movimientos_personal', 'idx_movimiento_reporte', ['fecha_efectiva', 'tipo', 'colaborador_id']);
    await ensureIndex(queryInterface, 'consultas_chat', 'idx_chat_reporte_resolucion', ['creado_en', 'resolucion', 'escalamiento_realizado']);
    await ensureIndex(queryInterface, 'consultas_chat', 'idx_chat_reporte_intencion', ['creado_en', 'intencion', 'resolucion']);
  },

  async down() {
    throw new Error('La eliminacion del registro de tareas programadas esta deshabilitada; prepare una migracion revisada.');
  }
};
