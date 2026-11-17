'use strict';
const { z } = require('zod');
const { getSupabase } = require('../config/supabase');
const MODEL = 'gemini-embedding-001';
const DIMENSIONS = 768;
const vector = z.array(z.number().finite()).length(DIMENSIONS).refine((v) => v.some((n) => n !== 0), 'El vector no puede ser cero.');
const chunkSchema = z.strictObject({
  document_id: z.string().uuid(), drive_file_id: z.string().min(1).max(255),
  title: z.string().min(1).max(250), content: z.string().min(1).max(20000),
  section: z.string().max(250).nullable().optional(), page_number: z.number().int().positive().nullable().optional(),
  chunk_index: z.number().int().nonnegative(), version: z.string().min(1).max(32),
  source_url: z.string().url().nullable().optional(), category: z.enum(['POLITICA', 'PROCEDIMIENTO', 'DOCUMENTO_PUBLICO']),
  effective_date: z.iso.date().nullable().optional(), content_hash: z.string().regex(/^[a-f0-9]{64}$/),
  embedding_model: z.literal(MODEL), embedding: vector,
  metadata: z.strictObject({ source_type: z.enum(['POLITICA', 'PROCEDIMIENTO', 'DOCUMENTO_PUBLICO']).optional() }).default({})
});
const client = () => getSupabase();
function unwrap(result) { if (result.error) throw new Error(`Error en almacén vectorial: ${result.error.code || 'SUPABASE_ERROR'}`); return result.data; }
async function run(operation) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const result = await operation();
    if (!result.error || ![429, 502, 503, 504].includes(result.status) || attempt === 2) return unwrap(result);
    await new Promise((resolve) => setTimeout(resolve, 100 * (2 ** attempt)));
  }
}
async function checkConnection() { await run(() => client().from('document_chunks').select('id', { count: 'exact', head: true })); return { connected: true }; }
async function insertChunk(input) {
  const data = chunkSchema.parse(input);
  await run(() => client().from('document_chunks').upsert({ ...data, is_active: false, validation_status: 'PENDIENTE' }, { onConflict: 'document_id,version,chunk_index', ignoreDuplicates: true }));
  const existing = await run(() => client().from('document_chunks').select('id,content_hash').eq('document_id', data.document_id).eq('version', data.version).eq('chunk_index', data.chunk_index).single());
  if (existing.content_hash !== data.content_hash) throw new Error('La posición ya existe con contenido distinto; cree una nueva versión.');
  return { id: existing.id };
}
async function updateChunk(id, input) { z.string().uuid().parse(id); const data = chunkSchema.parse(input); return run(() => client().from('document_chunks').update({ ...data, validation_status: 'PENDIENTE' }).eq('id', id).eq('is_active', false).select('id').single()); }
async function deleteChunk(id) { z.string().uuid().parse(id); await run(() => client().from('document_chunks').delete().eq('id', id).eq('is_active', false)); }
async function searchDocuments(embedding, threshold = Number(process.env.RAG_SIMILARITY_THRESHOLD || 0.75), count = Number(process.env.RAG_TOP_K || 5)) {
  vector.parse(embedding); z.number().min(0).max(1).parse(threshold); z.number().int().min(1).max(20).parse(count);
  return run(() => client().rpc('match_documents', { query_embedding: embedding, match_threshold: threshold, match_count: count }));
}
async function filterDocuments(category) { z.enum(['POLITICA', 'PROCEDIMIENTO', 'DOCUMENTO_PUBLICO']).parse(category); return run(() => client().from('document_chunks').select('id,document_id,title,section,version,source_url').eq('category', category).eq('validation_status', 'VALIDADO').eq('is_active', true)); }
async function publishVersion(documentId, version, expectedCount) {
  z.string().uuid().parse(documentId); z.string().min(1).max(32).parse(version); z.number().int().min(1).max(10000).parse(expectedCount);
  return run(() => client().rpc('publish_document_version', { p_document_id: documentId, p_version: version, p_expected_count: expectedCount }));
}
module.exports = { MODEL, DIMENSIONS, vector, chunkSchema, checkConnection, insertChunk, updateChunk, deleteChunk, searchDocuments, filterDocuments, publishVersion };
