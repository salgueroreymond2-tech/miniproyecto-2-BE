'use strict';

const { DataTypes } = require('sequelize');

const CATEGORIAS = ['restringida', 'fuera_alcance', 'politica', 'dato_personal', 'tema_dashboard'];

function definePalabraClave(sequelize) {
  if (sequelize.models.PalabraClave) return sequelize.models.PalabraClave;

  return sequelize.define('PalabraClave', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
    palabra: { type: DataTypes.STRING(100), allowNull: false },
    categoria: { type: DataTypes.ENUM(...CATEGORIAS), allowNull: false },
    tema_asociado: { type: DataTypes.STRING(100), allowNull: true },
    activa: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }
  }, {
    tableName: 'palabras_clave',
    freezeTableName: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { name: 'uq_palabras_clave_palabra_categoria', unique: true, fields: ['palabra', 'categoria'] },
      { name: 'idx_palabras_clave_categoria_activa', fields: ['categoria', 'activa'] }
    ]
  });
}

definePalabraClave.CATEGORIAS = CATEGORIAS;
module.exports = definePalabraClave;
