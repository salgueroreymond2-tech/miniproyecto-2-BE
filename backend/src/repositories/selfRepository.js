'use strict';
const { QueryTypes } = require('sequelize');
const db = require('../config/database');
const query = (sql, bind) => db.getConnection().query(sql, { bind, type: QueryTypes.SELECT });
async function getProfile(userId) {
  const rows = await query(`SELECT c.codigo,c.nombres,c.apellidos,c.email_corporativo,d.nombre AS departamento,p.nombre AS puesto,c.modalidad,c.estado,c.fecha_ingreso FROM colaboradores c JOIN departamentos d ON d.id=c.departamento_id JOIN puestos p ON p.id=c.puesto_id WHERE c.usuario_id=$userId`, { userId });
  return rows[0] ?? null;
}
async function getVacations(userId) {
  return query('SELECT s.periodo_anual,s.dias_generados,s.dias_disfrutados,s.dias_ajuste,s.dias_disponibles FROM saldos_vacaciones s JOIN colaboradores c ON c.id=s.colaborador_id WHERE c.usuario_id=$userId ORDER BY s.periodo_anual DESC', { userId });
}
async function getRequests(userId) {
  return query('SELECT s.id,s.tipo,s.fecha_inicio,s.fecha_fin,s.dias_solicitados,s.estado,s.creado_en FROM solicitudes s JOIN colaboradores c ON c.id=s.colaborador_id WHERE c.usuario_id=$userId ORDER BY s.creado_en DESC', { userId });
}
async function getNextPayday() {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Costa_Rica', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const rows = await query('SELECT fecha_pago,fecha_corte_inicio,fecha_corte_fin,tipo FROM calendario_pagos WHERE estado=$estado AND fecha_pago >= $today ORDER BY fecha_pago ASC LIMIT 1', { estado: 'PROGRAMADO', today });
  return rows[0] ?? null;
}
async function listEmployees() {
  return query('SELECT c.codigo,c.nombres,c.apellidos,c.email_corporativo,d.nombre AS departamento,p.nombre AS puesto,c.estado FROM colaboradores c JOIN departamentos d ON d.id=c.departamento_id JOIN puestos p ON p.id=c.puesto_id ORDER BY c.apellidos,c.nombres LIMIT 200', {});
}
module.exports = { getProfile, getVacations, getRequests, getNextPayday, listEmployees };
