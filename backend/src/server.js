'use strict';

require('dotenv').config();
const { z } = require('zod');
const { createApp } = require('./app');
const authRepository = require('./repositories/authRepository');
const selfRepository = require('./repositories/selfRepository');
const { closePool } = require('./config/database');

const config = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  CORS_ORIGIN: z.string().url().default('http://localhost:5173'),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().regex(/^[1-9][0-9]*[smhd]$/).default('1h')
}).parse(process.env);

const app = createApp({ secret: config.JWT_SECRET, expiresIn: config.JWT_EXPIRES_IN,
  corsOrigin: config.CORS_ORIGIN, authRepository, selfRepository });
const server = app.listen(config.PORT, () => console.log(`API disponible en el puerto ${config.PORT}`));
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => { closePool().catch(() => { process.exitCode = 1; }); }));
}
