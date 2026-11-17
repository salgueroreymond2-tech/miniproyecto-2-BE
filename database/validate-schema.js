'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const databaseDirectory = __dirname;
const load = (fileName) => fs.readFileSync(path.join(databaseDirectory, fileName), 'utf8');
const schema = load('schema.sql');
const indexes = load('indexes.sql');
const seed = load('seed.sql');
const permissions = load('permissions.sql');

const requiredTables = [
  'colaboradores',
  'saldos_vacaciones',
  'solicitudes',
  'incapacidades',
  'movimientos_personal',
  'consultas_chat',
  'reportes_diarios',
  'usuarios',
  'calendario_pagos',
  'evaluaciones_desempeno',
  'documentos',
  'fragmentos_documentos',
  'sincronizaciones',
  'logs_agentes'
];

for (const tableName of requiredTables) {
  assert.match(schema, new RegExp(`CREATE TABLE ${tableName} \\(`), `Falta la tabla ${tableName}.`);
}

assert.match(schema, /embedding vector\(768\)/, 'La columna de embeddings debe tener 768 dimensiones.');
assert.match(schema, /embedding_model = 'gemini-embedding-001' AND embedding_dimension = 768/, 'Falta la restricción de modelo de embedding.');
assert.match(indexes, /vector_cosine_ops/, 'Falta el índice de similitud vectorial.');
assert.match(permissions, /ENABLE ROW LEVEL SECURITY/, 'Falta habilitar RLS.');
assert.match(permissions, /REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon/, 'Falta revocar acceso anónimo.');
assert.match(seed, /generate_series\(1, 50\)/, 'El seed debe generar 50 colaboradores ficticios.');
assert.match(seed, /2026-09-01/, 'El seed debe incluir movimientos de los últimos tres meses de demostración.');
assert.doesNotMatch(schema, /diagnostico/i, 'El esquema no debe almacenar diagnósticos médicos.');

console.log('Validación estática del esquema PostgreSQL: correcta.');
