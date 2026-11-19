'use strict';

const { DataTypes } = require('sequelize');

const tableName = 'palabras_clave';
const categorias = ['restringida', 'fuera_alcance', 'politica', 'dato_personal', 'tema_dashboard'];

function tableExists(tables) {
  return tables.some((table) => String(typeof table === 'string' ? table : table.tableName || Object.values(table)[0]).toLowerCase() === tableName);
}

async function ensureIndex(queryInterface, name, fields, unique = false) {
  const indexes = await queryInterface.showIndex(tableName);
  if (!indexes.some((index) => index.name === name)) await queryInterface.addIndex(tableName, fields, { name, unique });
}

module.exports = {
  async up(queryInterface) {
    const tables = await queryInterface.showAllTables();
    if (!tableExists(tables)) {
      await queryInterface.createTable(tableName, {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
        palabra: { type: DataTypes.STRING(100), allowNull: false },
        categoria: { type: DataTypes.ENUM(...categorias), allowNull: false },
        tema_asociado: { type: DataTypes.STRING(100), allowNull: true },
        activa: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
        created_at: { type: DataTypes.DATE, allowNull: false },
        updated_at: { type: DataTypes.DATE, allowNull: false }
      });
    }
    await ensureIndex(queryInterface, 'uq_palabras_clave_palabra_categoria', ['palabra', 'categoria'], true);
    await ensureIndex(queryInterface, 'idx_palabras_clave_categoria_activa', ['categoria', 'activa']);
  },
  async down() {
    throw new Error('La eliminación de palabras_clave está deshabilitada; prepare una migración revisada.');
  }
};
