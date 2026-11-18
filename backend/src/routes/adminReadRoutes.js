'use strict';

const { Router } = require('express');
const { authenticate, requireRole } = require('../middleware/authMiddleware');
const { createAdminReadController } = require('../controllers/adminReadController');

function createAdminReadRouter(authService, repository) {
  const router = Router();
  const controller = createAdminReadController(repository);
  const secure = [authenticate(authService), requireRole('RRHH')];
  router.get('/departments', ...secure, controller.departments);
  router.get('/requests', ...secure, controller.requests);
  router.get('/documents', ...secure, controller.documents);
  router.get('/synchronizations', ...secure, controller.synchronizations);
  return router;
}

module.exports = { createAdminReadRouter };
