'use strict';

const { Router } = require('express');
const { authenticate, requireRole } = require('../middleware/authMiddleware');
const { createReportController } = require('../controllers/reportController');

function createReportRouter(authService, analystAgent, reportJobs) {
  const router = Router();
  const controller = createReportController(analystAgent, reportJobs);
  router.use(authenticate(authService), requireRole('RRHH'));
  router.get('/latest', controller.latest);
  router.get('/history', controller.history);
  router.post('/generate', controller.generate);
  router.get('/:date', controller.byDate);
  return router;
}

module.exports = { createReportRouter };
