'use strict';

const path = require('node:path');
const { z } = require('zod');
const { vector, MODEL, DIMENSIONS } = require('./vector-store.service');

async function defaultLoader() {
  const { pipeline, env } = await import('@huggingface/transformers');
  // La caché del modelo permanece local y fuera de Git; la inferencia no usa ninguna API de embeddings.
  env.cacheDir = path.resolve(__dirname, '../../.cache/huggingface');
  return pipeline('feature-extraction', MODEL, { dtype: 'q8', device: 'cpu' });
}

function createEmbeddingService({ loadPipeline = defaultLoader } = {}) {
  let pipelinePromise;
  function validateConfiguration() {
    if (process.env.EMBEDDING_MODEL && process.env.EMBEDDING_MODEL !== MODEL) throw new Error('El modelo configurado requiere una migración y reindexación.');
    if (process.env.EMBEDDING_DIMENSIONS && Number(process.env.EMBEDDING_DIMENSIONS) !== DIMENSIONS) throw new Error('La dimensión configurada requiere una migración y reindexación.');
  }
  async function warmUpEmbeddings() {
    validateConfiguration();
    if (!pipelinePromise) {
      pipelinePromise = (async () => {
        const extractor = await loadPipeline();
        const warm = await extractor('query: calentamiento', { pooling: 'mean', normalize: true });
        vector.parse(Array.from(warm.data));
        return extractor;
      })().catch((error) => { pipelinePromise = undefined; throw error; });
    }
    return pipelinePromise;
  }
  async function createEmbedding(text, purpose = 'RETRIEVAL_DOCUMENT') {
    const input = z.string().trim().min(1).max(20000).parse(text);
    z.enum(['RETRIEVAL_DOCUMENT', 'RETRIEVAL_QUERY']).parse(purpose);
    const prefix = purpose === 'RETRIEVAL_QUERY' ? 'query: ' : 'passage: ';
    const extractor = await warmUpEmbeddings();
    const output = await extractor(prefix + input, { pooling: 'mean', normalize: true, truncation: true });
    return vector.parse(Array.from(output.data));
  }
  return { warmUpEmbeddings, createEmbedding };
}

const service = createEmbeddingService();
module.exports = { ...service, createEmbeddingService };
