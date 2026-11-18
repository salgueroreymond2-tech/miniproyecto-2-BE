'use strict';

const { Op } = require('sequelize');
const { z } = require('zod');
const { getReadConnection } = require('../config/database');
const { initModels } = require('../models');

const uuidSchema = z.string().uuid();

function costaRicaToday() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Costa_Rica',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return values.year + '-' + values.month + '-' + values.day;
}

function plain(record, fields) {
  const value = typeof record?.get === 'function' ? record.get({ plain: true }) : record;
  return Object.fromEntries(fields.map((field) => [field, value?.[field] ?? null]));
}

function createEmployeeDataRepository({
  connectionFactory = getReadConnection,
  modelsFactory = initModels,
  todayProvider = costaRicaToday
} = {}) {
  function models() {
    // Esta capa recibe exclusivamente la conexión configurada con DB_READ_USER/DB_READ_PASSWORD.
    return modelsFactory(connectionFactory());
  }

  async function findOwnCollaborator(authenticatedUserId) {
    const userId = uuidSchema.parse(authenticatedUserId);
    const { Colaborador } = models();
    return Colaborador.findOne({
      where: { usuario_id: userId },
      attributes: ['id']
    });
  }

  async function getVacationBalance(authenticatedUserId) {
    const employee = await findOwnCollaborator(authenticatedUserId);
    if (!employee) return { profileFound: false };
    const { SaldoVacaciones } = models();
    const rows = await SaldoVacaciones.findAll({
      where: { colaborador_id: employee.id },
      attributes: ['periodo_anual', 'dias_generados', 'dias_ajuste', 'dias_disfrutados', 'dias_disponibles'],
      order: [['periodo_anual', 'DESC']]
    });
    return rows.map((row) => plain(row, ['periodo_anual', 'dias_generados', 'dias_ajuste', 'dias_disfrutados', 'dias_disponibles']));
  }

  async function getEmployeeRequests(authenticatedUserId) {
    const employee = await findOwnCollaborator(authenticatedUserId);
    if (!employee) return { profileFound: false };
    const { Solicitud } = models();
    const rows = await Solicitud.findAll({
      where: { colaborador_id: employee.id },
      attributes: ['id', 'tipo', 'fecha_inicio', 'fecha_fin', 'dias_solicitados', 'estado', 'creado_en'],
      order: [['creado_en', 'DESC']],
      limit: 100
    });
    return rows.map((row) => plain(row, ['id', 'tipo', 'fecha_inicio', 'fecha_fin', 'dias_solicitados', 'estado', 'creado_en']));
  }

  async function getRequestStatus(authenticatedUserId, requestId) {
    const employee = await findOwnCollaborator(authenticatedUserId);
    if (!employee) return { profileFound: false };
    const id = uuidSchema.parse(requestId);
    const { Solicitud } = models();
    const row = await Solicitud.findOne({
      where: { id, colaborador_id: employee.id },
      attributes: ['id', 'tipo', 'fecha_inicio', 'fecha_fin', 'dias_solicitados', 'estado', 'creado_en']
    });
    return row ? plain(row, ['id', 'tipo', 'fecha_inicio', 'fecha_fin', 'dias_solicitados', 'estado', 'creado_en']) : null;
  }

  async function getNextPayment(authenticatedUserId) {
    const employee = await findOwnCollaborator(authenticatedUserId);
    if (!employee) return { profileFound: false };
    const { CalendarioPago } = models();
    const row = await CalendarioPago.findOne({
      where: { estado: 'PROGRAMADO', fecha_pago: { [Op.gte]: todayProvider() } },
      attributes: ['fecha_pago', 'fecha_corte_inicio', 'fecha_corte_fin', 'tipo'],
      order: [['fecha_pago', 'ASC']]
    });
    return row ? plain(row, ['fecha_pago', 'fecha_corte_inicio', 'fecha_corte_fin', 'tipo']) : null;
  }

  async function getEmployeeAbsences(authenticatedUserId) {
    const employee = await findOwnCollaborator(authenticatedUserId);
    if (!employee) return { profileFound: false };
    const { Incapacidad, Solicitud } = models();
    const [incapacities, leaves] = await Promise.all([
      Incapacidad.findAll({
        where: { colaborador_id: employee.id },
        attributes: ['fecha_inicio', 'fecha_fin', 'estado'],
        order: [['fecha_inicio', 'DESC']],
        limit: 100
      }),
      Solicitud.findAll({
        where: {
          colaborador_id: employee.id,
          estado: 'APROBADA',
          tipo: { [Op.in]: ['VACACIONES', 'PERMISO_PERSONAL', 'PERMISO_DUELO', 'PERMISO_FORMACION', 'LICENCIA_SIN_GOCE'] }
        },
        attributes: ['tipo', 'fecha_inicio', 'fecha_fin', 'estado'],
        order: [['fecha_inicio', 'DESC']],
        limit: 100
      })
    ]);
    return [
      ...incapacities.map((row) => ({ tipo: 'INCAPACIDAD', ...plain(row, ['fecha_inicio', 'fecha_fin', 'estado']) })),
      ...leaves.map((row) => plain(row, ['tipo', 'fecha_inicio', 'fecha_fin', 'estado']))
    ].sort((a, b) => String(b.fecha_inicio).localeCompare(String(a.fecha_inicio)));
  }

  async function getNextPerformanceEvaluation(authenticatedUserId) {
    const employee = await findOwnCollaborator(authenticatedUserId);
    if (!employee) return { profileFound: false };
    const { EvaluacionDesempeno } = models();
    const row = await EvaluacionDesempeno.findOne({
      where: {
        colaborador_id: employee.id,
        estado: { [Op.in]: ['BORRADOR', 'PENDIENTE'] },
        periodo_inicio: { [Op.gte]: todayProvider() }
      },
      attributes: ['periodo_inicio', 'periodo_fin', 'estado'],
      order: [['periodo_inicio', 'ASC']]
    });
    return row ? plain(row, ['periodo_inicio', 'periodo_fin', 'estado']) : null;
  }

  return {
    getVacationBalance,
    getEmployeeRequests,
    getRequestStatus,
    getNextPayment,
    getEmployeeAbsences,
    getNextPerformanceEvaluation
  };
}

const defaultRepository = createEmployeeDataRepository();
module.exports = { costaRicaToday, createEmployeeDataRepository, ...defaultRepository };
