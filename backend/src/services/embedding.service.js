'use strict';
const { GoogleGenAI } = require('@google/genai');
const { z } = require('zod');
const { vector, MODEL, DIMENSIONS } = require('./vector-store.service');

async function createEmbedding(text, purpose = 'RETRIEVAL_DOCUMENT') {
  z.string().trim().min(1).max(20000).parse(text);
  z.enum(['RETRIEVAL_DOCUMENT', 'RETRIEVAL_QUERY']).parse(purpose);
  if (!process.env.GEMINI_API_KEY) throw Object.assign(new Error('GEMINI_API_KEY no configurada.'), { code: 'GEMINI_NOT_CONFIGURED' });
  if (process.env.EMBEDDING_MODEL && process.env.EMBEDDING_MODEL !== MODEL) throw new Error('El modelo configurado requiere una migración del almacén vectorial.');
  if (process.env.EMBEDDING_DIMENSIONS && Number(process.env.EMBEDDING_DIMENSIONS) !== DIMENSIONS) throw new Error('La dimensión configurada requiere una migración del almacén vectorial.');
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const result = await ai.models.embedContent({ model: MODEL, contents: text, config: { taskType: purpose, outputDimensionality: DIMENSIONS } });
  return vector.parse(result.embeddings?.[0]?.values);
}
module.exports = { createEmbedding };
