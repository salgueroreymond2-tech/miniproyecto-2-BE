'use strict';

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const HttpError = require('../utils/httpError');

// El hash fijo evita omitir bcrypt cuando el correo no existe; no es una cuenta de acceso.
const dummyHash = '$2b$12$B0qrAyI5boeS05yu36UG0e6grENxHvUrPNtzBaZWB3vYOCOi47ZmC';

function createAuthService({ repository, secret, expiresIn = '1h' }) {
  if (typeof secret !== 'string' || Buffer.byteLength(secret, 'utf8') < 32) {
    throw new Error('JWT_SECRET debe tener al menos 32 bytes.');
  }
  async function login(email, password) {
    const user = await repository.findByEmail(email);
    const valid = await bcrypt.compare(password, user?.password_hash || dummyHash);
    if (!user || !user.activo || !valid) throw new HttpError(401, 'Credenciales inválidas.');
    const token = jwt.sign({}, secret, { subject: user.id, expiresIn, algorithm: 'HS256' });
    return { token, usuario: { id: user.id, email: user.email, rol: user.rol } };
  }
  async function authenticate(token) {
    let payload;
    try { payload = jwt.verify(token, secret, { algorithms: ['HS256'] }); }
    catch { throw new HttpError(401, 'Sesión inválida o vencida.'); }
    if (typeof payload !== 'object' || typeof payload.sub !== 'string') {
      throw new HttpError(401, 'Sesión inválida o vencida.');
    }
    const user = await repository.findById(payload.sub);
    if (!user || !user.activo) throw new HttpError(401, 'Sesión inválida o vencida.');
    return { id: user.id, email: user.email, rol: user.rol };
  }
  return { login, authenticate };
}

module.exports = { createAuthService };
