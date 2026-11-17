'use strict';

require('dotenv').config();
const readline = require('node:readline');
const bcrypt = require('bcrypt');
const { z } = require('zod');
const db = require('../config/database');

async function main() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error('Se requiere una terminal interactiva.');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  const email = await new Promise((resolve) => rl.question('Correo del usuario: ', resolve));
  // Desactiva el eco solo durante la lectura de la contraseña, sin guardarla en argumentos.
  process.stdout.write('Nueva contraseña: ');
  rl.stdoutMuted = true;
  rl._writeToOutput = function writeToOutput(text) { if (!this.stdoutMuted) this.output.write(text); };
  const password = await new Promise((resolve) => rl.question('', resolve));
  rl.stdoutMuted = false;
  process.stdout.write('\n');
  rl.close();
  const validEmail = z.string().trim().email().max(254).parse(email);
  if (password.length < 12 || Buffer.byteLength(password, 'utf8') > 72) throw new Error('La contraseña debe tener al menos 12 caracteres y como máximo 72 bytes UTF-8.');
  const hash = await bcrypt.hash(password, 12);
  const result = await db.query('UPDATE usuarios SET password_hash = $1 WHERE email = $2 RETURNING id', [hash, validEmail]);
  if (result.rowCount !== 1) throw new Error('No se encontró el usuario.');
  console.log('Contraseña actualizada.');
}

main().catch((error) => { console.error('No se pudo actualizar la contraseña:', error.code || error.message); process.exitCode = 1; }).finally(() => db.closePool());
