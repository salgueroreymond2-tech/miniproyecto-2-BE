'use strict';
require('dotenv').config();
const { createEmbedding, warmUpEmbeddings } = require('../services/embedding.service');
const { similarity, DIMENSIONS } = require('../services/vector-store.service');

async function main() {
  await warmUpEmbeddings();
  const question = await createEmbedding('¿Cómo solicito vacaciones?', 'RETRIEVAL_QUERY');
  const passage = await createEmbedding('Las solicitudes de vacaciones se presentan en el portal de personas.', 'RETRIEVAL_DOCUMENT');
  const questionNorm = Math.hypot(...question);
  const passageNorm = Math.hypot(...passage);
  if (question.length !== DIMENSIONS || passage.length !== DIMENSIONS || Math.abs(questionNorm - 1) > 0.0001 || Math.abs(passageNorm - 1) > 0.0001) throw new Error('Dimensión o normalización incorrecta.');
  console.log(JSON.stringify({ model: 'Xenova/multilingual-e5-small', dimensions: question.length, normalized: true, similarity: similarity(question, passage) }, null, 2));
}
main().catch((error) => { console.error('No se pudo verificar el modelo local:', error.code || error.name); process.exitCode = 1; });
