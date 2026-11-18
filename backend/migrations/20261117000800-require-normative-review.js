'use strict';

const { DataTypes } = require('sequelize');

module.exports = {
  async up(queryInterface) {
    const columns = await queryInterface.describeTable('ingestion_approvals');
    if (!columns.normative_reviewed) {
      await queryInterface.addColumn('ingestion_approvals', 'normative_reviewed', {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      });
    }
  },
  async down() {
    throw new Error('La eliminación de la revisión normativa está deshabilitada; prepare una migración revisada.');
  }
};
