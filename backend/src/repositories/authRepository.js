'use strict';

const db = require('../config/database');

async function findByEmail(email) {
  const result = await db.query(
    'SELECT id, email, password_hash, rol, activo FROM usuarios WHERE email = $1', [email]
  );
  return result.rows[0] ?? null;
}

async function findById(id) {
  const result = await db.query(
    'SELECT id, email, rol, activo FROM usuarios WHERE id = $1', [id]
  );
  return result.rows[0] ?? null;
}

module.exports = { findByEmail, findById };
