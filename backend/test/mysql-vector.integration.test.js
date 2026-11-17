'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, createHash } = require('node:crypto');

test('MySQL conserva versiones y recupera por similitud sin guardar datos de prueba', { skip: process.env.MYSQL_INTEGRATION !== '1' }, async () => {
  require('dotenv').config();
  const db = require('../src/config/database');
  const { initModels } = require('../src/models');
  const store = require('../src/services/vector-store.service');
  const connection = db.getConnection();
  const originalTransaction = connection.transaction.bind(connection);
  const outer = await originalTransaction();
  const models = initModels(connection);
  const documentId = randomUUID();
  const embedding = Array(768).fill(0); embedding[0] = 1;
  const second = Array(768).fill(0); second[1] = 1;
  const chunk = (index, values) => ({ document_id: documentId, drive_file_id: 'ficticio-integracion', title: 'Política ficticia de prueba', content: `Fragmento ficticio ${index}`, section: 'Pruebas', chunk_index: index, version: '1.0', category: 'POLITICA', content_hash: createHash('sha256').update(`contenido ${index}`).digest('hex'), embedding_model: store.MODEL, embedding: values, metadata: {} });
  try {
    await models.Documento.create({ id: documentId, drive_file_id: `test-${documentId}`, titulo: 'Documento ficticio de integración', version: '1.0', estado: 'VALIDADO' }, { transaction: outer });
    // Los métodos crean transacciones anidadas; la prueba revierte todas mediante la transacción exterior.
    connection.transaction = (options, callback) => {
      const fn = typeof options === 'function' ? options : callback;
      return originalTransaction({ transaction: outer }, fn);
    };
    const first = await store.insertChunk(chunk(0, embedding));
    assert.equal((await store.insertChunk(chunk(0, embedding))).id, first.id);
    assert.equal((await store.searchDocuments(embedding, 0.9, 5)).some((item) => item.id === first.id), false);
    await assert.rejects(store.publishVersion(documentId, '1.0', 2), /incompleta/);
    await store.insertChunk(chunk(1, second));
    assert.equal(await store.publishVersion(documentId, '1.0', 2), 2);
    const results = await store.searchDocuments(embedding, 0.9, 5);
    assert.equal(results.some((item) => item.id === first.id && item.similarity > 0.999), true);
    assert.equal(results.some((item) => item.content === 'Fragmento ficticio 1'), false);
    await models.Documento.update({ estado: 'ELIMINADO' }, { where: { id: documentId }, transaction: outer });
    assert.equal((await store.searchDocuments(embedding, 0.9, 5)).some((item) => item.id === first.id), false);
    await assert.rejects(store.deleteChunk(first.id), /activo/);
  } finally {
    connection.transaction = originalTransaction;
    await outer.rollback();
    await db.closePool();
  }
});
