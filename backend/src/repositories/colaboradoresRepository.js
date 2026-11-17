'use strict';
const { initModels } = require('../models');
async function findById(id) {
  const m = initModels();
  return m.Colaborador.findOne({ where: { id }, attributes: ['id', 'codigo', 'nombres', 'apellidos', 'email_corporativo', 'modalidad', 'estado', 'fecha_ingreso', 'fecha_salida'], raw: true });
}
async function listByDepartment(departamento) {
  const m = initModels();
  return m.Colaborador.findAll({ attributes: ['id', 'codigo', 'nombres', 'apellidos', 'estado'], include: [{ model: m.Departamento, attributes: [], where: { nombre: departamento }, required: true }], order: [['apellidos', 'ASC'], ['nombres', 'ASC']], raw: true });
}
module.exports = { findById, listByDepartment };
