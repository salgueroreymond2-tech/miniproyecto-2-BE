'use strict';

const { Router } = require('express');
const { authenticate, requireRole } = require('../middleware/authMiddleware');
const { rejectQuery } = require('../middleware/validation');
const { createCollaboratorController } = require('../controllers/collaboratorController');

function createCollaboratorRouter(authService, repository) {
  const router = Router();
  const controller = createCollaboratorController(repository);
  router.use(authenticate(authService), rejectQuery);
  router.get('/me', controller.profile);
  router.get('/me/vacaciones', controller.vacations);
  router.get('/me/solicitudes', controller.requests);
  router.get('/me/proximo-pago', controller.payday);
  router.get('/', requireRole('RRHH'), controller.list);
  return router;
}
module.exports = { createCollaboratorRouter };
