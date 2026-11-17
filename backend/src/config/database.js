'use strict';

const { Pool } = require('pg');
const { z } = require('zod');

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().url().optional(),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(20).default(10),
  DATABASE_IDLE_TIMEOUT_MS: z.coerce.number().int().min(1000).default(30000),
  DATABASE_CONNECT_TIMEOUT_MS: z.coerce.number().int().min(1000).default(5000),
  DATABASE_SSL: z.enum(['true', 'false']).default('false'),
  DATABASE_SSL_REJECT_UNAUTHORIZED: z.enum(['true', 'false']).default('true')
});

const environment = environmentSchema.parse(process.env);
let pool;

function databaseIsConfigured() {
  return Boolean(environment.DATABASE_URL);
}

function getPool() {
  if (!databaseIsConfigured()) {
    const error = new Error('DATABASE_URL no está configurada en el entorno del servidor.');
    error.code = 'DATABASE_NOT_CONFIGURED';
    throw error;
  }

  if (!pool) {
    // Esta configuración vive solo en Node.js; nunca se expone a Vite o al navegador.
    pool = new Pool({
      connectionString: environment.DATABASE_URL,
      max: environment.DATABASE_POOL_MAX,
      idleTimeoutMillis: environment.DATABASE_IDLE_TIMEOUT_MS,
      connectionTimeoutMillis: environment.DATABASE_CONNECT_TIMEOUT_MS,
      ssl: environment.DATABASE_SSL === 'true'
        ? { rejectUnauthorized: environment.DATABASE_SSL_REJECT_UNAUTHORIZED === 'true' }
        : undefined
    });
  }

  return pool;
}

async function query(sql, values = []) {
  if (typeof sql !== 'string' || sql.trim().length === 0) {
    throw new TypeError('La consulta SQL debe ser un texto no vacío.');
  }
  if (!Array.isArray(values)) {
    throw new TypeError('Los valores de la consulta deben enviarse como arreglo parametrizado.');
  }
  return getPool().query(sql, values);
}

async function withTransaction(callback) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function checkDatabaseConnection() {
  if (!databaseIsConfigured()) {
    return { configured: false, connected: false, reason: 'DATABASE_URL no configurada' };
  }

  try {
    const result = await query('SELECT current_database() AS database_name, now() AS checked_at');
    return { configured: true, connected: true, ...result.rows[0] };
  } catch (error) {
    return { configured: true, connected: false, reason: error.message };
  }
}

async function closePool() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

module.exports = {
  checkDatabaseConnection,
  closePool,
  databaseIsConfigured,
  getPool,
  query,
  withTransaction
};
