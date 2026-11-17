'use strict';

const db = require('../config/database');

async function getProfile(userId) {
  const result = await db.query(
    `SELECT codigo, nombres, apellidos, email_corporativo, departamento, puesto,
            modalidad, estado, fecha_ingreso
       FROM colaboradores WHERE usuario_id = $1`, [userId]
  );
  return result.rows[0] ?? null;
}

async function getVacations(userId) {
  const result = await db.query(
    `SELECT s.periodo_anual, s.dias_generados, s.dias_disfrutados, s.dias_ajuste, s.dias_disponibles
       FROM saldos_vacaciones s JOIN colaboradores c ON c.id = s.colaborador_id
      WHERE c.usuario_id = $1 ORDER BY s.periodo_anual DESC`, [userId]
  );
  return result.rows;
}

async function getRequests(userId) {
  const result = await db.query(
    `SELECT s.id, s.tipo, s.fecha_inicio, s.fecha_fin, s.dias_solicitados, s.estado, s.creado_en
       FROM solicitudes s JOIN colaboradores c ON c.id = s.colaborador_id
      WHERE c.usuario_id = $1 ORDER BY s.creado_en DESC`, [userId]
  );
  return result.rows;
}

async function getNextPayday() {
  const result = await db.query(
    `SELECT fecha_pago, fecha_corte_inicio, fecha_corte_fin, tipo
       FROM calendario_pagos
      WHERE estado = $1 AND fecha_pago >= (CURRENT_TIMESTAMP AT TIME ZONE 'America/Costa_Rica')::date
      ORDER BY fecha_pago ASC LIMIT 1`, ['PROGRAMADO']
  );
  return result.rows[0] ?? null;
}

async function listEmployees() {
  const result = await db.query(
    `SELECT codigo, nombres, apellidos, email_corporativo, departamento, puesto, estado
       FROM colaboradores ORDER BY apellidos, nombres LIMIT $1`, [200]
  );
  return result.rows;
}

module.exports = { getProfile, getVacations, getRequests, getNextPayday, listEmployees };
