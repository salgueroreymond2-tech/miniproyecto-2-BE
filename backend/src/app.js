'use strict';

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const swagger = require('swagger-ui-express');
const { createAuthService } = require('./services/authService');
const { createAuthRouter } = require('./routes/authRoutes');
const { createCollaboratorRouter } = require('./routes/collaboratorRoutes');
const { createIngestionRouter } = require('./routes/ingestionRoutes');
const { createChatRouter } = require('./routes/chatRoutes');
const { createReportRouter } = require('./routes/reportRoutes');
const { createAdminReadRouter } = require('./routes/adminReadRoutes');
const ingestionAgentDefault = require('./services/ingestion.agent');
const orchestratorAgentDefault = require('./services/orchestrator.agent');
const analystAgentDefault = require('./services/analyst.agent');
const { createAdminReadRepository } = require('./repositories/adminReadRepository');
const HttpError = require('./utils/httpError');
const apiSpec = require('./config/openapi');

function createApp({ secret, expiresIn, corsOrigin, authRepository, selfRepository, ingestionAgent = ingestionAgentDefault, orchestratorAgent = orchestratorAgentDefault, analystAgent = analystAgentDefault, reportJobs, adminReadRepository = createAdminReadRepository() }) {
  const app = express();
  const auth = createAuthService({ repository: authRepository, secret, expiresIn });
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: corsOrigin, methods: ['GET', 'POST'], allowedHeaders: ['Content-Type', 'Authorization'] }));
  app.use(express.json({ limit: '16kb' }));
  app.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/api/docs', swagger.serve, swagger.setup(apiSpec));
  app.use('/api/auth', createAuthRouter(auth));
  app.use('/api/colaboradores', createCollaboratorRouter(auth, selfRepository));
  app.use('/api/admin', createAdminReadRouter(auth, adminReadRepository));
  app.use('/api/admin/ingestion', createIngestionRouter(auth, ingestionAgent));
  app.use('/api/chat', createChatRouter(auth, orchestratorAgent));
  app.use('/api/reports', createReportRouter(auth, analystAgent, reportJobs));
  app.use((_req, _res, next) => next(new HttpError(404, 'Ruta no encontrada.')));
  app.use((error, _req, res, _next) => {
    if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido.' });
    if (error.type === 'entity.too.large') return res.status(413).json({ error: 'Solicitud demasiado grande.' });
    if (error instanceof HttpError) return res.status(error.status).json({ error: error.message });
    console.error('Error interno de API:', error.code || error.name);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  });
  return app;
}
module.exports = { createApp };
