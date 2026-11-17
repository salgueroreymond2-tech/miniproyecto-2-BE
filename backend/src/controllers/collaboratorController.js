'use strict';

const HttpError = require('../utils/httpError');

function createCollaboratorController(repository) {
  return {
    profile: async (req, res) => {
      const profile = await repository.getProfile(req.user.id);
      if (!profile) throw new HttpError(404, 'No existe un perfil asociado a esta cuenta.');
      res.json({ colaborador: profile });
    },
    vacations: async (req, res) => res.json({ saldos: await repository.getVacations(req.user.id) }),
    requests: async (req, res) => res.json({ solicitudes: await repository.getRequests(req.user.id) }),
    payday: async (_req, res) => res.json({ proximoPago: await repository.getNextPayday() }),
    list: async (_req, res) => res.json({ colaboradores: await repository.listEmployees() })
  };
}
module.exports = { createCollaboratorController };
