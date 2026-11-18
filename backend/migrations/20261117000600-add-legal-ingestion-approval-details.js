'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE ingestion_approvals
        ADD COLUMN category ENUM('POLITICA','PROCEDIMIENTO','DOCUMENTO_PUBLICO') NULL,
        ADD COLUMN effective_date DATE NULL,
        ADD COLUMN legal_sources JSON NULL,
        ADD COLUMN data_reviewed BOOLEAN NOT NULL DEFAULT FALSE
    `);
  },
  async down() {
    throw new Error('La reversión destructiva está deshabilitada; prepare una migración revisada.');
  }
};
