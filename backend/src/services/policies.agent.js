'use strict';

const { randomUUID } = require('node:crypto');
const { performance } = require('node:perf_hooks');
const { z } = require('zod');
const { getConnection } = require('../config/database');
const { initModels } = require('../models');
const embeddingService = require('./embedding.service');
const vectorStore = require('./vector-store.service');
const { createDeepSeekService } = require('./deepseek.service');
const { SYSTEM_PROMPT, buildEvidencePrompt } = require('../prompts/policies.prompt');

const TOP_K = 5;
const AGENT_NAME = 'POLITICAS';
const FALLBACK_ANSWER = 'No encontré evidencia documental suficiente para responder. Contacta a RRHH para confirmar la información.';
const inputSchema = z.strictObject({
  question: z.string().trim().min(1).max(4000),
  userId: z.string().uuid(),
  persistAudit: z.boolean().default(true)
});
const retrievedChunkSchema = z.object({
  id: z.string().uuid(),
  document_id: z.string().uuid(),
  drive_file_id: z.string().min(1).max(255),
  title: z.string().min(1).max(250),
  content: z.string().min(1).max(20000),
  section: z.string().max(250).nullable(),
  page_number: z.number().int().positive().nullable(),
  version: z.string().min(1).max(32),
  source_url: z.string().nullable(),
  similarity: z.number().finite().min(-1).max(1)
});
const responseSchema = z.strictObject({
  sufficientEvidence: z.boolean(),
  claims: z.array(z.strictObject({
    text: z.string().trim().min(1).max(1500),
    chunkIds: z.array(z.string().uuid()).min(1).max(TOP_K)
  })).max(8)
});
const resolutionSchema = z.enum(['RESPONDIDA', 'SIN_EVIDENCIA', 'ERROR']);

function thresholdValue(value) {
  const parsed = z.coerce.number().finite().min(0).max(1).safeParse(value);
  if (!parsed.success) {
    const error = new Error('RAG_SIMILARITY_THRESHOLD debe ser un número entre 0 y 1.');
    error.code = 'RAG_THRESHOLD_INVALID';
    throw error;
  }
  return parsed.data;
}

function driveLink(chunk) {
  if (chunk.source_url) {
    const parsedUrl = z.string().url().safeParse(chunk.source_url);
    if (parsedUrl.success) {
      const url = new URL(parsedUrl.data);
      if (url.protocol === 'https:' && ['drive.google.com', 'docs.google.com'].includes(url.hostname.toLowerCase())) {
        return url.toString();
      }
    }
  }
  return `https://drive.google.com/open?id=${encodeURIComponent(chunk.drive_file_id)}`;
}

function buildGroundedAnswer(output, chunks) {
  if (!output.sufficientEvidence || output.claims.length === 0) return null;
  const byId = new Map(chunks.map((chunk) => [chunk.id, chunk]));
  const cited = new Map();
  for (const claim of output.claims) {
    const ids = [...new Set(claim.chunkIds)];
    if (!ids.length || ids.some((id) => !byId.has(id))) return null;
    // Solo se publica texto que exista literalmente en el fragmento que lo respalda.
    if (!ids.every((id) => byId.get(id).content.includes(claim.text))) return null;
    for (const id of ids) cited.set(id, byId.get(id));
  }

  const citations = [...cited.values()].map((chunk, index) => ({
    reference: index + 1,
    chunkId: chunk.id,
    documentId: chunk.document_id,
    title: chunk.title,
    section: chunk.section,
    version: chunk.version,
    ...(chunk.page_number === null ? {} : { page: chunk.page_number }),
    link: driveLink(chunk)
  }));
  const referenceById = new Map(citations.map((citation) => [citation.chunkId, citation.reference]));
  const answer = output.claims.map((claim) => (
    `“${claim.text}” ${[...new Set(claim.chunkIds)].map((id) => `[${referenceById.get(id)}]`).join(' ')}`
  )).join('\n\n');
  const documents = new Map();
  for (const citation of citations) {
    const key = `${citation.documentId}:${citation.version}`;
    if (!documents.has(key)) {
      documents.set(key, {
        documentId: citation.documentId,
        title: citation.title,
        version: citation.version,
        link: citation.link
      });
    }
  }
  return { answer, citations, documentsCited: [...documents.values()] };
}

function createPoliciesAgent({
  createEmbedding = embeddingService.createEmbedding,
  searchDocuments = vectorStore.searchDocuments,
  deepSeekService = createDeepSeekService(),
  modelsFactory = initModels,
  connectionFactory = getConnection,
  similarityThreshold = process.env.RAG_SIMILARITY_THRESHOLD ?? 0.75
} = {}) {
  const threshold = thresholdValue(similarityThreshold);

  async function persistQuery({
    consultationId, userId, question, answer, resolution, latencyMs, chunksUsed, documentsCited
  }) {
    const parsedResolution = resolutionSchema.parse(resolution);
    const models = modelsFactory();
    await connectionFactory().transaction(async (transaction) => {
      await models.ConsultaChat.create({
        id: consultationId,
        usuario_id: userId,
        pregunta: question,
        respuesta: answer,
        agente: AGENT_NAME,
        creado_en: new Date(),
        resolucion: parsedResolution,
        latencia_ms: latencyMs,
        fragmentos_utilizados: chunksUsed.map(({ id, similarity, cited }) => ({ id, similarity, cited })),
        documentos_citados: documentsCited
      }, { transaction });
      await models.LogAgente.create({
        id: randomUUID(),
        consulta_chat_id: consultationId,
        agente: AGENT_NAME,
        operacion: 'RESPONDER_CONSULTA',
        estado: parsedResolution === 'ERROR' ? 'ERROR' : 'COMPLETADO',
        creado_en: new Date()
      }, { transaction });
    });
  }

  async function answer(input) {
    const { question, userId, persistAudit } = inputSchema.parse(input);
    const consultationId = randomUUID();
    const startedAt = performance.now();
    let chunksUsed = [];

    try {
      const embedding = await createEmbedding(question, 'RETRIEVAL_QUERY');
      const retrieved = await searchDocuments(embedding, threshold, TOP_K);
      if (!Array.isArray(retrieved)) throw new TypeError('La búsqueda documental devolvió un resultado inválido.');
      const chunks = retrieved
        .map((chunk) => retrievedChunkSchema.parse(chunk))
        .filter((chunk) => chunk.similarity >= threshold)
        .slice(0, TOP_K);
      chunksUsed = chunks.map((chunk) => ({ ...chunk, cited: false }));

      let outcome;
      if (chunks.length === 0) {
        outcome = { answer: FALLBACK_ANSWER, resolution: 'SIN_EVIDENCIA', citations: [], documentsCited: [] };
      } else {
        const generated = await deepSeekService.generateStructured({
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: buildEvidencePrompt(question, chunks) }
          ],
          maxTokens: 1200
        }, responseSchema);
        const modelOutput = responseSchema.parse(generated.data);
        const grounded = buildGroundedAnswer(modelOutput, chunks);
        if (!grounded) {
          outcome = { answer: FALLBACK_ANSWER, resolution: 'SIN_EVIDENCIA', citations: [], documentsCited: [] };
        } else {
          const citedIds = new Set(grounded.citations.map((citation) => citation.chunkId));
          chunksUsed = chunksUsed.map((chunk) => ({ ...chunk, cited: citedIds.has(chunk.id) }));
          outcome = { ...grounded, resolution: 'RESPONDIDA' };
        }
      }

      const latencyMs = Math.round(performance.now() - startedAt);
      if (persistAudit) {
        await persistQuery({
          consultationId, userId, question, answer: outcome.answer, resolution: outcome.resolution,
          latencyMs, chunksUsed, documentsCited: outcome.documentsCited
        });
      }
      return {
        consultationId, ...outcome, latencyMs,
        retrievedFragments: chunksUsed.map(({ id, similarity, cited }) => ({ id, similarity, cited }))
      };
    } catch (error) {
      const latencyMs = Math.round(performance.now() - startedAt);
      if (persistAudit) {
        try {
          await persistQuery({
            consultationId, userId, question, answer: null, resolution: 'ERROR',
            latencyMs, chunksUsed, documentsCited: []
          });
        } catch (auditError) {
          throw new AggregateError([error, auditError], 'La consulta falló y no fue posible registrar el error en MySQL.');
        }
      }
      throw error;
    }
  }

  return { answer };
}

const defaultAgent = createPoliciesAgent();
module.exports = {
  TOP_K,
  AGENT_NAME,
  FALLBACK_ANSWER,
  responseSchema,
  buildGroundedAnswer,
  createPoliciesAgent,
  ...defaultAgent
};
