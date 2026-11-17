'use strict';
const fs = require('node:fs');
const path = require('node:path');
module.exports = {
  async up(queryInterface) {
    const sql = fs.readFileSync(path.join(__dirname, '../../database/mysql/schema.sql'), 'utf8');
    // MySQL aplica DDL con commit implícito; detenerse al primer error evita ocultar instalaciones parciales.
    for (const statement of sql.split(';').map((part) => part.trim()).filter(Boolean)) {
      await queryInterface.sequelize.query(statement);
    }
  },
  async down() {
    throw new Error('La reversión destructiva está deshabilitada; use una migración revisada.');
  }
};
