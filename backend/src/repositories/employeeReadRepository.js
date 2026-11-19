'use strict';

const { getReadConnection } = require('../config/database');
const { initModels } = require('../models');

function createEmployeeReadRepository({ connectionFactory = getReadConnection, modelsFactory = initModels } = {}) {
  async function getOwnVacations(authenticatedUserId) {
    const models = modelsFactory(connectionFactory());
    return models.SaldoVacaciones.findAll({
      attributes: ['periodo_anual', 'dias_generados', 'dias_disfrutados', 'dias_disponibles'],
      include: [{ model: models.Colaborador, attributes: [], where: { usuario_id: authenticatedUserId }, required: true }],
      order: [['periodo_anual', 'DESC']],
      raw: true
    });
  }
  return { getOwnVacations };
}

const defaultRepository = createEmployeeReadRepository();
module.exports = { createEmployeeReadRepository, ...defaultRepository };
