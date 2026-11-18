'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Op } = require('sequelize');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const {
  createChunks,
  createIngestionAgent,
  detectPersonalData,
  extractFileDocument,
  extractFileText,
  normalizeOfficialSources
} = require('../src/services/ingestion.agent');

function makeTokenizer() {
  const ids = new Map();
  const tokens = new Map();
  let nextId = 10;
  return {
    encode(text, { add_special_tokens: addSpecialTokens = true } = {}) {
      const words = String(text).match(/\S+/gu) || [];
      const wordIds = words.map((word) => {
        if (!ids.has(word)) {
          ids.set(word, nextId);
          tokens.set(nextId, word);
          nextId += 1;
        }
        return ids.get(word);
      });
      return addSpecialTokens ? [1, ...wordIds, 2] : wordIds;
    },
    decode(values) {
      return values.filter((id) => id !== 1 && id !== 2).map((id) => tokens.get(id)).join(' ');
    }
  };
}

function createMemoryModel(keyName = 'id') {
  const model = { rows: [] };
  const matches = (row, where) => Object.entries(where).every(([key, value]) => (
    value && typeof value === 'object' && Object.hasOwn(value, Op.ne)
      ? row[key] !== value[Op.ne]
      : row[key] === value
  ));
  function instance(row) {
    return {
      ...row,
      async update(values) {
        Object.assign(row, values);
        Object.assign(this, values);
        return this;
      }
    };
  }
  model.create = async (values) => {
    const row = { ...values };
    model.rows.push(row);
    return instance(row);
  };
  model.findByPk = async (value) => {
    const row = model.rows.find((item) => item[keyName] === value);
    return row ? instance(row) : null;
  };
  model.findOne = async ({ where = {} } = {}) => {
    const row = model.rows.find((item) => matches(item, where));
    return row ? instance(row) : null;
  };
  model.findAll = async ({ where = {} } = {}) => model.rows
    .filter((item) => matches(item, where))
    .map(instance);
  model.count = async ({ where = {} } = {}) => model.rows
    .filter((item) => matches(item, where)).length;
  model.bulkCreate = async (rows) => {
    model.rows.push(...rows.map((row) => ({ ...row })));
    return rows;
  };
  model.destroy = async ({ where = {} } = {}) => {
    const before = model.rows.length;
    model.rows = model.rows.filter((item) => !matches(item, where));
    return before - model.rows.length;
  };
  model.increment = async (field, { by = 1, where = {} } = {}) => {
    for (const row of model.rows.filter((item) => Object.entries(where).every(([key, value]) => item[key] === value))) {
      row[field] = Number(row[field]) + by;
    }
  };
  return model;
}

function makeModels() {
  return {
    Documento: createMemoryModel(),
    DocumentChunk: createMemoryModel(),
    IngestionApproval: createMemoryModel(),
    DriveIngestionState: createMemoryModel('folder_id'),
    VectorCacheState: createMemoryModel(),
    Sincronizacion: createMemoryModel()
  };
}

test('excluye identificadores y datos personales, sin confundir años legales con teléfonos', () => {
  assert.equal(detectPersonalData('Cédula: 1-2345-6789'), true);
  assert.equal(detectPersonalData('correo: persona@example.com'), true);
  assert.equal(detectPersonalData('La política fue revisada entre 2020 y 2021.'), false);
  assert.deepEqual(normalizeOfficialSources(['https://pgrweb.go.cr/scij/ley']), ['https://pgrweb.go.cr/scij/ley']);
  assert.throws(() => normalizeOfficialSources(['https://example.com/ley']), { code: 'UNTRUSTED_LEGAL_SOURCE' });
});

test('fragmenta con tokenizer real inyectable, conserva encabezados y respeta prefijo y límite E5', () => {
  const tokenizer = makeTokenizer();
  const text = `## Vacaciones\n${Array(1000).fill('contenido').join(' ')}`;
  const chunks = createChunks(tokenizer, text);
  assert.ok(chunks.length >= 3);
  assert.equal(chunks[0].section, 'Vacaciones');
  assert.ok(chunks.every((chunk) => chunk.modelTokenCount <= 512));
  assert.ok(chunks.every((chunk) => chunk.tokenCount <= 450));
  assert.ok(chunks.every((chunk) => chunk.tokenCount >= 350));
  const firstIds = tokenizer.encode(chunks[0].content, { add_special_tokens: false });
  const nextIds = tokenizer.encode(chunks[1].content, { add_special_tokens: false });
  assert.deepEqual(firstIds.slice(-64), nextIds.slice(0, 64));
});

test('preserva documentos con una longitud que no permite todos los tamaños objetivo', () => {
  const tokenizer = makeTokenizer();
  const words = Array.from({ length: 862 }, (_value, index) => `palabra${index}`);
  const chunks = createChunks(tokenizer, words.join(' '));
  const recovered = new Set(chunks.flatMap((chunk) => chunk.content.split(/\s+/u)));
  assert.ok(chunks.every((chunk) => chunk.tokenCount <= 450));
  assert.ok(chunks.some((chunk) => chunk.tokenCount < 350));
  assert.ok(words.every((word) => recovered.has(word)));
});

test('extrae texto local de PDF, DOCX, XLSX, TXT, Google Docs y Google Sheets', async () => {
  const directory = path.resolve(__dirname, '../../documents/policies');
  const pdf = await fs.readFile(path.join(directory, '01-vacaciones-y-feriados.pdf'));
  const docx = await fs.readFile(path.join(directory, '01-vacaciones-y-feriados.docx'));
  const xlsx = await fs.readFile(path.join(directory, 'matriz-conocimiento-politicas.xlsx'));
  const cases = [
    { kind: 'pdf', file: { id: 'pdf', name: 'policy.pdf', mimeType: 'application/pdf' }, data: pdf, method: 'get' },
    { kind: 'docx', file: { id: 'docx', name: 'policy.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }, data: docx, method: 'get' },
    { kind: 'xlsx', file: { id: 'xlsx', name: 'matrix.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }, data: xlsx, method: 'get' },
    { kind: 'txt', file: { id: 'txt', name: 'policy.txt', mimeType: 'text/plain' }, data: Buffer.from('Política laboral ficticia.'), method: 'get' },
    { kind: 'google-doc', file: { id: 'gdoc', name: 'Google Doc', mimeType: 'application/vnd.google-apps.document' }, data: Buffer.from('Documento de Google ficticio.'), method: 'export' },
    { kind: 'google-sheet', file: { id: 'gsheet', name: 'Google Sheet', mimeType: 'application/vnd.google-apps.spreadsheet' }, data: xlsx, method: 'export' }
  ];
  for (const item of cases) {
    const drive = { files: { [item.method]: async () => ({ data: item.data }) } };
    const extracted = await extractFileText(drive, item.file, item.kind);
    assert.ok(extracted.length > 10, `${item.kind} no produjo texto`);
  }
  const docxText = await extractFileText({ files: { get: async () => ({ data: docx }) } }, cases[1].file);
  assert.match(docxText, /(?:^|\n)#{1,6} /u, 'la extracción DOCX debe conservar los encabezados');
  const pdfDocument = await extractFileDocument({ files: { get: async () => ({ data: pdf }) } }, cases[0].file);
  assert.equal(pdfDocument.pages.length, 2);
  assert.deepEqual(pdfDocument.pages.map((page) => page.page_number), [1, 2]);
  const pageChunks = createChunks(makeTokenizer(), pdfDocument.text, pdfDocument.pages);
  assert.ok(pageChunks.every((chunk) => chunk.page_number === 1 || chunk.page_number === 2));
});

test('sincroniza un documento aprobado, deja modificaciones pendientes y retira eliminados', async () => {
  const models = makeModels();
  const folderId = 'folder_123456789';
  const fileId = 'file_123456789';
  const secondFileId = 'file_987654321';
  const originalText = Array(400).fill('política').join(' ');
  const originalHash = createHash('sha256').update(originalText, 'utf8').digest('hex');
  const legalSources = ['https://www.mtss.go.cr/temas-laborales/'];
  models.VectorCacheState.rows.push({ id: 1, revision: 0 });
  const movedDocumentId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  models.Documento.rows.push({
    id: movedDocumentId,
    drive_file_id: 'moved_child_file_123',
    titulo: 'Documento en subcarpeta movida',
    version: '1',
    estado: 'VALIDADO',
    content_hash: 'e'.repeat(64)
  });
  models.DocumentChunk.rows.push({ id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', document_id: movedDocumentId, is_active: true });
  models.IngestionApproval.rows.push({
    id: 'approval-1',
    drive_file_id: fileId,
    content_hash: originalHash,
    category: 'POLITICA',
    effective_date: null,
    legal_sources: legalSources,
    data_reviewed: true,
    normative_reviewed: true,
    approved_by: '00000000-0000-4000-8000-000000000001'
  });
  const file = {
    id: fileId,
    name: 'Política general.txt',
    mimeType: 'text/plain',
    modifiedTime: '2026-11-17T00:00:00.000Z',
    webViewLink: `https://drive.google.com/file/d/${fileId}/view`,
    parents: [folderId],
    size: '100'
  };
  const secondFile = { ...file, id: secondFileId, name: 'Otra política.txt', webViewLink: `https://drive.google.com/file/d/${secondFileId}/view` };
  const changes = [
    { data: { changes: [{ fileId, file: { ...file, modifiedTime: '2026-11-18T00:00:00.000Z' } }], newStartPageToken: 'cursor-1' } },
    { data: { changes: [{ fileId, removed: true }], newStartPageToken: 'cursor-2' } }
  ];
  let listCalls = 0;
  const drive = {
    files: {
      list: async () => { listCalls += 1; return { data: { files: [file, secondFile] } }; },
      get: async ({ fileId: requestedId }) => ({ data: requestedId === secondFileId ? secondFile : file })
    },
    changes: {
      getStartPageToken: async () => ({ data: { startPageToken: 'cursor-0' } }),
      list: async () => changes.shift()
    }
  };
  let currentText = originalText;
  const agent = createIngestionAgent({
    env: { GOOGLE_DRIVE_FOLDER_ID: folderId },
    driveClient: drive,
    modelRegistry: () => models,
    connectionFactory: () => ({ transaction: async (operation) => operation({ LOCK: { UPDATE: 'UPDATE' } }) }),
    embeddingService: { createEmbedding: async () => [1, ...Array(383).fill(0)] },
    tokenizerLoader: async () => makeTokenizer(),
    textExtractor: async (_drive, currentFile) => currentFile.id === secondFileId
      ? Array(400).fill('otra').join(' ')
      : currentText
  });

  const pilot = await agent.pilot(fileId);
  assert.equal(listCalls, 0, 'el piloto debe leer únicamente el archivo seleccionado');
  assert.equal(pilot.indexed, 1, JSON.stringify(pilot));
  assert.equal(models.Documento.rows.find((document) => document.drive_file_id === fileId).estado, 'VALIDADO');
  assert.equal(models.DocumentChunk.rows.length, 2);
  assert.deepEqual(models.DocumentChunk.rows.find((chunk) => chunk.drive_file_id === fileId).metadata.legal_sources, legalSources);
  assert.equal(models.VectorCacheState.rows[0].revision, 1);
  assert.equal((await agent.status()).pilotComplete, true);
  assert.equal((await agent.status()).initialSyncComplete, false);

  currentText = Array(400).fill('política actualizada').join(' ');
  const changed = await agent.sync();
  assert.equal(changed.indexed, 0);
  assert.equal(models.Documento.rows.find((document) => document.drive_file_id === fileId).estado, 'PENDIENTE');
  assert.equal(models.Documento.rows.length, 3, 'la sincronización posterior debe recorrer el resto de la carpeta');
  assert.equal(models.Documento.rows.find((document) => document.drive_file_id === secondFileId).estado, 'PENDIENTE');
  assert.equal(models.Documento.rows.find((document) => document.drive_file_id === 'moved_child_file_123').estado, 'ELIMINADO');
  assert.equal(models.DocumentChunk.rows.some((chunk) => chunk.document_id === movedDocumentId), false);
  assert.ok(listCalls >= 2);
  assert.equal(models.DocumentChunk.rows.length, 0);
  assert.equal(models.VectorCacheState.rows[0].revision, 3);

  const deleted = await agent.sync();
  assert.equal(deleted.deleted, 1);
  assert.equal(models.Documento.rows.find((document) => document.drive_file_id === fileId).estado, 'ELIMINADO');
  assert.equal(models.DocumentChunk.rows.length, 0);
});
