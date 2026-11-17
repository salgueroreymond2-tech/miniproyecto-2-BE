'use strict';
const { QueryTypes } = require('sequelize');
const db = require('../config/database');
async function findByEmail(email) {
  const rows = await db.getConnection().query('SELECT id, email, password_hash, rol, activo FROM usuarios WHERE email = $email', { bind: { email }, type: QueryTypes.SELECT });
  return rows[0] ?? null;
}
async function findById(id) {
  const rows = await db.getConnection().query('SELECT id, email, rol, activo FROM usuarios WHERE id = $id', { bind: { id }, type: QueryTypes.SELECT });
  return rows[0] ?? null;
}
module.exports = { findByEmail, findById };
