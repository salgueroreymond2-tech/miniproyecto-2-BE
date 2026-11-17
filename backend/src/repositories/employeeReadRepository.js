'use strict';
const { QueryTypes } = require('sequelize');
const { getReadConnection } = require('../config/database');
// El identificador procede exclusivamente de la sesión autenticada en el servicio llamador.
async function getOwnVacations(authenticatedUserId) {
  return getReadConnection().query(
    'SELECT s.periodo_anual,s.dias_generados,s.dias_disfrutados,s.dias_disponibles FROM saldos_vacaciones s JOIN colaboradores c ON c.id=s.colaborador_id WHERE c.usuario_id=$userId ORDER BY s.periodo_anual DESC',
    { bind: { userId: authenticatedUserId }, type: QueryTypes.SELECT }
  );
}
module.exports = { getOwnVacations };
