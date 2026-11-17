'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, createHash } = require('node:crypto');

test('embeddings E5 reales se almacenan y recuperan desde MySQL', { skip: process.env.MYSQL_REAL_EMBEDDINGS !== '1', timeout: 180000 }, async () => {
  require('dotenv').config();
  const db = require('../src/config/database');
  const { initModels } = require('../src/models');
  const store = require('../src/services/vector-store.service');
  const embeddings = require('../src/services/embedding.service');
  const passage = 'Las solicitudes de vacaciones se presentan en el portal de personas.';
  const query = '¿Cómo solicito vacaciones?';
  const passageVector = await embeddings.createEmbedding(passage, 'RETRIEVAL_DOCUMENT');
  const queryVector = await embeddings.createEmbedding(query, 'RETRIEVAL_QUERY');
  const connection = db.getConnection();
  const originalTransaction = connection.transaction.bind(connection);
  const outer = await originalTransaction();
  const models = initModels(connection);
  const documentId = randomUUID();
  try {
    await models.Documento.create({ id: documentId, drive_file_id: `test-e5-${documentId}`, titulo: 'Política ficticia de vacaciones', version: '1.0', estado: 'VALIDADO' }, { transaction: outer });
    connection.transaction = (options, callback) => originalTransaction({ transaction: outer }, typeof options === 'function' ? options : callback);
    const chunk = await store.insertChunk({ document_id: documentId, drive_file_id: 'ficticio', title: 'Política ficticia de vacaciones', content: passage, chunk_index: 0, version: '1.0', category: 'POLITICA', content_hash: createHash('sha256').update(passage).digest('hex'), embedding_model: store.MODEL, embedding: passageVector, metadata: {} });
    await store.publishVersion(documentId, '1.0', 1);
    const results = await store.searchDocuments(queryVector, 0.5, 20);
    assert.equal(results.some((result) => result.id === chunk.id && result.similarity > 0.5), true);
  } finally {
    connection.transaction = originalTransaction;
    await outer.rollback();
    await db.closePool();
  }
});
