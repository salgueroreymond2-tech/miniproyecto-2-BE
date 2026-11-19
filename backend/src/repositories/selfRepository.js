'use strict';

const { Op } = require('sequelize');
const { getConnection } = require('../config/database');
const { initModels } = require('../models');

function createSelfRepository({ connectionFactory = getConnection, modelsFactory = initModels, todayProvider = costaRicaToday } = {}) {
  function models() {
    return modelsFactory(connectionFactory());
  }

  async function getProfile(authenticatedUserId) {
    const m = models();
    const record = await m.Colaborador.findOne({
      where: { usuario_id: authenticatedUserId },
      attributes: ['codigo', 'nombres', 'apellidos', 'email_corporativo', 'modalidad', 'estado', 'fecha_ingreso'],
      include: [
        { model: m.Departamento, attributes: ['nombre'], required: true },
        { model: m.Puesto, attributes: ['nombre'], required: true }
      ]
    });
    if (!record) return null;
    const value = record.get({ plain: true });
    return {
      codigo: value.codigo,
      nombres: value.nombres,
      apellidos: value.apellidos,
      email_corporativo: value.email_corporativo,
      departamento: value.Departamento.nombre,
      puesto: value.Puesto.nombre,
      modalidad: value.modalidad,
      estado: value.estado,
      fecha_ingreso: value.fecha_ingreso
    };
  }

  async function getVacations(authenticatedUserId) {
    const m = models();
    return m.SaldoVacaciones.findAll({
      attributes: ['periodo_anual', 'dias_generados', 'dias_disfrutados', 'dias_ajuste', 'dias_disponibles'],
      include: [{ model: m.Colaborador, attributes: [], where: { usuario_id: authenticatedUserId }, required: true }],
      order: [['periodo_anual', 'DESC']],
      raw: true
    });
  }

  async function getRequests(authenticatedUserId) {
    const m = models();
    return m.Solicitud.findAll({
      attributes: ['id', 'tipo', 'fecha_inicio', 'fecha_fin', 'dias_solicitados', 'estado', 'creado_en'],
      include: [{ model: m.Colaborador, attributes: [], where: { usuario_id: authenticatedUserId }, required: true }],
      order: [['creado_en', 'DESC']],
      raw: true
    });
  }

  async function getNextPayday() {
    const m = models();
    return m.CalendarioPago.findOne({
      where: { estado: 'PROGRAMADO', fecha_pago: { [Op.gte]: todayProvider() } },
      attributes: ['fecha_pago', 'fecha_corte_inicio', 'fecha_corte_fin', 'tipo'],
      order: [['fecha_pago', 'ASC']],
      raw: true
    });
  }

  async function listEmployees() {
    const m = models();
    const rows = await m.Colaborador.findAll({
      attributes: ['codigo', 'nombres', 'apellidos', 'email_corporativo', 'estado'],
      include: [
        { model: m.Departamento, attributes: ['nombre'], required: true },
        { model: m.Puesto, attributes: ['nombre'], required: true }
      ],
      order: [['apellidos', 'ASC'], ['nombres', 'ASC']],
      limit: 200
    });
    return rows.map((record) => {
      const employee = record.get({ plain: true });
      return {
        codigo: employee.codigo,
        nombres: employee.nombres,
        apellidos: employee.apellidos,
        email_corporativo: employee.email_corporativo,
        departamento: employee.Departamento.nombre,
        puesto: employee.Puesto.nombre,
        estado: employee.estado
      };
    });
  }

  return { getProfile, getVacations, getRequests, getNextPayday, listEmployees };
}

function costaRicaToday() {
  const values = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Costa_Rica', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date()).map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

const defaultRepository = createSelfRepository();
module.exports = { costaRicaToday, createSelfRepository, ...defaultRepository };
