'use strict';

function createAuthController(service) {
  return {
    login: async (req, res) => res.json(await service.login(req.login.email, req.login.password)),
    me: (req, res) => res.json({ usuario: req.user })
  };
}
module.exports = { createAuthController };
