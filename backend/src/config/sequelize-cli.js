'use strict';
require('dotenv').config();
const config = {
  username: process.env.DB_USER, password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'portal_rrhh', host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306), dialect: 'mysql', logging: false,
  migrationStorageTableName: 'SequelizeMeta', seederStorage: 'sequelize',
  define: { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' }
};
module.exports = { development: config, test: config, production: config };
