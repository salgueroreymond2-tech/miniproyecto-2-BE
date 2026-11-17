'use strict';

const { query } = require('../config/database');

async function findById(colaboradorId) {
  const result = await query(
    `SELECT id, codigo, nombres, apellidos, email_corporativo, departamento,
            puesto, modalidad, estado, fecha_ingreso, fecha_salida
       FROM colaboradores
      WHERE id = $1`,
    [colaboradorId]
  );

  return result.rows[0] ?? null;
}

async function listByDepartment(departamento) {
  const result = await query(
    `SELECT id, codigo, nombres, apellidos, puesto, estado
       FROM colaboradores
      WHERE departamento = $1
      ORDER BY apellidos, nombres`,
    [departamento]
  );

  return result.rows;
}

module.exports = {
  findById,
  listByDepartment
};
