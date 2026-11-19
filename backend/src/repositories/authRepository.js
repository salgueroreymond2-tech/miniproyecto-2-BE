'use strict';

const { getConnection } = require('../config/database');
const { initModels } = require('../models');

function createAuthRepository({ connectionFactory = getConnection, modelsFactory = initModels } = {}) {
  function usuarioModel() {
    return modelsFactory(connectionFactory()).Usuario;
  }

  async function findByEmail(email) {
    return usuarioModel().findOne({
      where: { email },
      attributes: ['id', 'email', 'password_hash', 'rol', 'activo'],
      raw: true
    });
  }

  async function findById(id) {
    return usuarioModel().findOne({
      where: { id },
      attributes: ['id', 'email', 'rol', 'activo'],
      raw: true
    });
  }

  return { findByEmail, findById };
}

const defaultRepository = createAuthRepository();
module.exports = { createAuthRepository, ...defaultRepository };
