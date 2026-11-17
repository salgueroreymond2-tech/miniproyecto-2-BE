'use strict';

const { Sequelize } = require('sequelize');
const { z } = require('zod');
const configSchema = z.object({
  DB_HOST: z.string().min(1).default('localhost'),
  DB_PORT: z.coerce.number().int().min(1).max(65535).default(3306),
  DB_NAME: z.string().min(1).default('portal_rrhh'),
  DB_USER: z.string().optional(), DB_PASSWORD: z.string().optional(),
  DB_READ_USER: z.string().optional(), DB_READ_PASSWORD: z.string().optional()
});
const settings = configSchema.parse(process.env);
let writeConnection;
let readConnection;
function makeConnection(user, password) {
  if (!user || !password) {
    const error = new Error('Credenciales MySQL no configuradas.');
    error.code = 'DATABASE_NOT_CONFIGURED';
    throw error;
  }
  return new Sequelize(settings.DB_NAME, user, password, {
    host: settings.DB_HOST, port: settings.DB_PORT, dialect: 'mysql', logging: false,
    timezone: '+00:00', dialectOptions: { charset: 'utf8mb4', connectTimeout: 5000 },
    pool: { max: 10, min: 0, acquire: 10000, idle: 10000 }
  });
}
function getConnection() {
  if (!writeConnection) writeConnection = makeConnection(settings.DB_USER, settings.DB_PASSWORD);
  return writeConnection;
}
function getReadConnection() {
  if (!readConnection) readConnection = makeConnection(settings.DB_READ_USER, settings.DB_READ_PASSWORD);
  return readConnection;
}
function databaseIsConfigured() { return Boolean(settings.DB_USER && settings.DB_PASSWORD); }
async function checkDatabaseConnection() {
  if (!databaseIsConfigured()) return { configured: false, connected: false, reason: 'Credenciales MySQL no configuradas' };
  try { await getConnection().authenticate(); return { configured: true, connected: true }; }
  catch (error) { return { configured: true, connected: false, reason: error.name }; }
}
async function closePool() {
  await Promise.all([writeConnection?.close(), readConnection?.close()]);
  writeConnection = undefined; readConnection = undefined;
}
module.exports = { getConnection, getReadConnection, databaseIsConfigured, checkDatabaseConnection, closePool };
