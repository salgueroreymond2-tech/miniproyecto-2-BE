'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { fn, col, Op } = require('sequelize');
const { z } = require('zod');
const { getConnection } = require('../config/database');
const { initModels } = require('../models');
const { createEmbedding } = require('./embedding.service');
const { MODEL } = require('./vector-store.service');

const FOLDER_MIME = 'application/vnd.google-apps.folder';
const GOOGLE_DOC_MIME = 'application/vnd.google-apps.document';
const GOOGLE_SHEET_MIME = 'application/vnd.google-apps.spreadsheet';
const GOOGLE_READ_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_DRIVE_FILES = 10000;
const MIN_CONTENT_TOKENS = 350;
const MAX_CONTENT_TOKENS = 450;
const OVERLAP_TOKENS = 64;
const MAX_EMBEDDING_TOKENS = 512;
const categories = ['POLITICA', 'PROCEDIMIENTO', 'DOCUMENTO_PUBLICO'];
const categorySchema = z.enum(categories);
const fileFields = 'id,name,mimeType,modifiedTime,version,md5Checksum,webViewLink,size,parents,trashed';
const officialHosts = new Set([
  'mtss.go.cr', 'www.mtss.go.cr',
  'pgrweb.go.cr', 'www.pgrweb.go.cr',
  'scij.go.cr', 'www.scij.go.cr',
  'ccss.sa.cr', 'www.ccss.sa.cr',
  'prodhab.go.cr', 'www.prodhab.go.cr',
  'asamblea.go.cr', 'www.asamblea.go.cr'
]);

function codedError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFC')
    .replace(/\u0000/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function detectPersonalData(value) {
  const text = String(value || '');
  const patterns = [
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
    /\b(?:c[eé]dula|identificaci[oó]n)\s*(?:n(?:[úu]mero|[.°º])?\s*)?[:#-]?\s*(?:[1-9]-\d{4}-\d{4}|\d{9,12})\b/i,
    /\b[1-9]-\d{4}-\d{4}\b/,
    /\bCR\d{20,22}\b/i,
    /\b\+?506[\s-]?[2-8]\d{3}[\s-]?\d{4}\b/i,
    /\b(?:tel[eé]fono|celular|m[oó]vil)\s*[:=]\s*[2-8]\d{3}[\s-]?\d{4}\b/i,
    /\b(?:nombre completo|apellidos?|correo(?: electr[oó]nico)?|tel[eé]fono|celular|cuenta bancaria|diagn[oó]stico(?: m[eé]dico)?|n[uú]mero de expediente|fecha de nacimiento)\s*[:=]\s*[^\n|]{2,}/i,
    /\b(?:colaborador|persona trabajadora|paciente)\s*[:=]\s*[A-ZÁÉÍÓÚÜÑ][A-ZÁÉÍÓÚÜÑa-záéíóúüñ'-]+(?:\s+[A-ZÁÉÍÓÚÜÑ][A-ZÁÉÍÓÚÜÑa-záéíóúüñ'-]+){1,3}\b/u
  ];
  return patterns.some((pattern) => pattern.test(text));
}

function splitIntoSections(text) {
  const sections = [];
  let heading = 'General';
  let lines = [];
  const flush = () => {
    const body = lines.join('\n').trim();
    if (body) sections.push({ heading, body });
    lines = [];
  };
  for (const line of normalizeText(text).split('\n')) {
    const markdown = /^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/.exec(line);
    const uppercase = /^\s*(?:\d+(?:\.\d+)*[.)]?\s+)?([A-ZÁÉÍÓÚÜÑ][A-ZÁÉÍÓÚÜÑ0-9\s:()/-]{2,120})\s*$/.exec(line);
    const nextHeading = markdown?.[1] || uppercase?.[1];
    if (nextHeading) {
      flush();
      heading = nextHeading.trim().slice(0, 250);
    } else {
      lines.push(line);
    }
  }
  flush();
  if (!sections.length) sections.push({ heading: 'General', body: normalizeText(text) });
  return sections;
}

function createChunks(tokenizer, text, pages = null) {
  if (!tokenizer || typeof tokenizer.encode !== 'function' || typeof tokenizer.decode !== 'function') {
    throw new TypeError('Se requiere el tokenizador local de E5.');
  }
  const tokenIds = [];
  const sectionRanges = [];
  const sourcePages = Array.isArray(pages) && pages.length ? pages : [{ page_number: null, text }];
  for (const page of sourcePages) {
    for (const section of splitIntoSections(page.text)) {
      const sectionText = [section.heading, section.body].filter(Boolean).join('\n');
      const ids = tokenizer.encode(sectionText, { add_special_tokens: false });
      if (!ids.length) continue;
      const start = tokenIds.length;
      tokenIds.push(...ids);
      sectionRanges.push({ start, end: tokenIds.length, heading: section.heading, pageNumber: page.page_number || null });
    }
  }
  if (!tokenIds.length) throw codedError('EMPTY_DOCUMENT', 'El documento no contiene texto indexable.');

  const windows = [];
  if (tokenIds.length <= MAX_CONTENT_TOKENS) {
    windows.push([0, tokenIds.length]);
  } else {
    const maxCount = Math.ceil(tokenIds.length / (MIN_CONTENT_TOKENS - 80)) + 1;
    const overlaps = [
      ...Array.from({ length: 17 }, (_value, index) => OVERLAP_TOKENS + index),
      ...Array.from({ length: 14 }, (_value, index) => OVERLAP_TOKENS - index - 1)
    ];
    let partitioned = false;
    for (let count = 2; count <= maxCount && !partitioned; count += 1) {
      for (const overlap of overlaps) {
        const minimumCovered = count * MIN_CONTENT_TOKENS - (count - 1) * overlap;
        const maximumCovered = count * MAX_CONTENT_TOKENS - (count - 1) * overlap;
        if (tokenIds.length < minimumCovered || tokenIds.length > maximumCovered) continue;
        let remaining = tokenIds.length + (count - 1) * overlap - count * MIN_CONTENT_TOKENS;
        let start = 0;
        for (let index = 0; index < count; index += 1) {
          const slots = count - index;
          const extra = Math.floor(remaining / slots) + (remaining % slots ? 1 : 0);
          const end = start + MIN_CONTENT_TOKENS + extra;
          windows.push([start, end]);
          remaining -= extra;
          start = end - overlap;
        }
        partitioned = true;
        break;
      }
    }
    if (!partitioned) {
      for (let start = 0; start < tokenIds.length;) {
        const end = Math.min(start + MAX_CONTENT_TOKENS, tokenIds.length);
        windows.push([start, end]);
        if (end === tokenIds.length) break;
        start = end - OVERLAP_TOKENS;
      }
    }
  }

  const chunks = [];
  for (const [start, end] of windows) {
    const content = tokenizer.decode(tokenIds.slice(start, end), {
      skip_special_tokens: true,
      clean_up_tokenization_spaces: false
    }).trim();
    if (content) {
      const actualContentTokens = tokenizer.encode(content, { add_special_tokens: false }).length;
      const modelTokens = tokenizer.encode(`passage: ${content}`, { add_special_tokens: true }).length;
      if (actualContentTokens > MAX_CONTENT_TOKENS) {
        throw codedError('CHUNK_TOKEN_LIMIT', 'El fragmento excede el máximo configurado de tokens de contenido.');
      }
      if (modelTokens > MAX_EMBEDDING_TOKENS) {
        throw codedError('EMBEDDING_TOKEN_LIMIT', 'El fragmento excede el límite de tokens de E5.');
      }
      const headings = sectionRanges
        .filter((section) => section.start < end && section.end > start)
        .map((section) => section.heading);
      const pageNumber = sectionRanges.find((section) => section.start < end && section.end > start)?.pageNumber || null;
      chunks.push({
        content,
        section: [...new Set(headings)].join(' / ').slice(0, 250) || null,
        page_number: pageNumber,
        tokenCount: actualContentTokens,
        modelTokenCount: modelTokens
      });
    }
  }
  return chunks;
}

function normalizeOfficialSources(input) {
  const sources = z.array(z.string().url()).min(1).max(10).parse(input);
  const unique = [...new Set(sources.map((source) => new URL(source).toString()))];
  for (const source of unique) {
    const url = new URL(source);
    if (url.protocol !== 'https:' || !officialHosts.has(url.hostname.toLowerCase())) {
      throw codedError('UNTRUSTED_LEGAL_SOURCE', 'Las fuentes deben pertenecer a sitios oficiales de Costa Rica y usar HTTPS.');
    }
  }
  return unique;
}

function classifyFile(file) {
  const mime = String(file.mimeType || '').toLowerCase();
  const extension = path.extname(file.name || '').toLowerCase();
  if (mime === GOOGLE_DOC_MIME) return 'google-doc';
  if (mime === GOOGLE_SHEET_MIME) return 'google-sheet';
  if (mime === 'application/pdf' || extension === '.pdf') return 'pdf';
  if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || extension === '.docx') return 'docx';
  if (mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || extension === '.xlsx') return 'xlsx';
  if (mime === 'text/plain' || extension === '.txt') return 'txt';
  return null;
}

async function responseBuffer(response) {
  const data = response?.data;
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof Uint8Array) return Buffer.from(data);
  if (data instanceof ArrayBuffer) return Buffer.from(new Uint8Array(data));
  if (typeof data === 'string') return Buffer.from(data, 'utf8');
  if (data && typeof data[Symbol.asyncIterator] === 'function') {
    const chunks = [];
    let size = 0;
    for await (const chunk of data) {
      const part = Buffer.from(chunk);
      size += part.length;
      if (size > MAX_FILE_BYTES) throw codedError('DRIVE_FILE_TOO_LARGE', 'El archivo supera el límite de ingesta.');
      chunks.push(part);
    }
    return Buffer.concat(chunks, size);
  }
  throw codedError('INVALID_DRIVE_RESPONSE', 'Drive devolvió un formato de archivo no compatible.');
}

async function validateZipArchive(buffer) {
  const yauzl = require('yauzl');
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true, autoClose: true }, (openError, archive) => {
      if (openError) return reject(codedError('INVALID_ARCHIVE', 'El documento comprimido no es válido.'));
      let entries = 0;
      let expandedBytes = 0;
      let settled = false;
      const fail = () => {
        if (settled) return;
        settled = true;
        archive.close();
        reject(codedError('ARCHIVE_LIMIT_EXCEEDED', 'El documento comprimido supera los límites seguros de extracción.'));
      };
      archive.on('error', fail);
      archive.on('entry', (entry) => {
        entries += 1;
        expandedBytes += entry.uncompressedSize;
        const ratio = entry.compressedSize === 0
          ? (entry.uncompressedSize > 0 ? Infinity : 0)
          : entry.uncompressedSize / entry.compressedSize;
        if (
          entries > 5000
          || entry.uncompressedSize > 30 * 1024 * 1024
          || expandedBytes > 80 * 1024 * 1024
          || ratio > 500
        ) return fail();
        archive.readEntry();
      });
      archive.on('end', () => {
        if (settled) return;
        settled = true;
        resolve();
      });
      archive.readEntry();
    });
  });
}

function excelCellText(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    if (Array.isArray(value.richText)) return value.richText.map((item) => item.text || '').join('');
    if (value.text !== undefined) return String(value.text);
    if (value.result !== undefined) return String(value.result);
    if (value.hyperlink) return String(value.text || value.hyperlink);
    return '';
  }
  return String(value);
}

async function extractFileDocument(drive, file, kind = classifyFile(file)) {
  if (!kind) throw codedError('UNSUPPORTED_FILE_TYPE', 'El formato del documento no está admitido.');
  let buffer;
  if (kind === 'google-doc') {
    const response = await drive.files.export({ fileId: file.id, mimeType: 'text/plain' }, { responseType: 'arraybuffer' });
    buffer = await responseBuffer(response);
  } else if (kind === 'google-sheet') {
    const response = await drive.files.export({
      fileId: file.id,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    }, { responseType: 'arraybuffer' });
    buffer = await responseBuffer(response);
  } else {
    const response = await drive.files.get(
      { fileId: file.id, alt: 'media', supportsAllDrives: true },
      { responseType: 'arraybuffer' }
    );
    buffer = await responseBuffer(response);
  }
  if (buffer.length > MAX_FILE_BYTES) throw codedError('DRIVE_FILE_TOO_LARGE', 'El archivo supera el límite de ingesta.');

  if (kind === 'txt' || kind === 'google-doc') {
    return { text: normalizeText(new TextDecoder('utf-8', { fatal: true }).decode(buffer)), pages: null };
  }
  if (kind === 'pdf') {
    const { PDFParse } = require('pdf-parse');
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      const pages = (result.pages || []).map((page, index) => ({
        page_number: Number(page.num) || index + 1,
        text: normalizeText(page.text)
      })).filter((page) => page.text);
      return { text: normalizeText(pages.length ? pages.map((page) => page.text).join('\n\n') : result.text), pages: pages.length ? pages : null };
    } finally {
      await parser.destroy();
    }
  }
  if (kind === 'docx') {
    await validateZipArchive(buffer);
    const mammoth = require('mammoth');
    const { Parser } = require('htmlparser2');
    const result = await mammoth.convertToHtml({ buffer });
    const lines = [];
    let current = '';
    const flush = () => {
      const line = current.trim();
      if (line) lines.push(line);
      current = '';
    };
    const parser = new Parser({
      onopentag(name) {
        const heading = /^h([1-6])$/.exec(name);
        if (heading) {
          flush();
          current = `${'#'.repeat(Number(heading[1]))} `;
        } else if (['p', 'li', 'tr', 'div'].includes(name)) {
          flush();
        } else if (name === 'td' || name === 'th') {
          if (current.trim()) current += ' | ';
        } else if (name === 'br') {
          flush();
        }
      },
      ontext(value) { current += value; },
      onclosetag(name) {
        if (/^h[1-6]$/.test(name) || ['p', 'li', 'tr', 'div'].includes(name)) flush();
      }
    }, { decodeEntities: true });
    parser.write(result.value);
    parser.end();
    flush();
    return { text: normalizeText(lines.join('\n')), pages: null };
  }
  if (kind === 'xlsx' || kind === 'google-sheet') {
    await validateZipArchive(buffer);
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const lines = [];
    for (const worksheet of workbook.worksheets) {
      lines.push(`## ${worksheet.name}`);
      worksheet.eachRow({ includeEmpty: false }, (row) => {
        const values = row.values.slice(1).map(excelCellText).filter((value) => value !== '');
        if (values.length) lines.push(values.join(' | '));
      });
    }
    return { text: normalizeText(lines.join('\n')), pages: null };
  }
  throw codedError('UNSUPPORTED_FILE_TYPE', 'El formato del documento no está admitido.');
}

async function extractFileText(drive, file, kind = classifyFile(file)) {
  return (await extractFileDocument(drive, file, kind)).text;
}

function makeDefaultDriveClient(env) {
  const folderId = String(env.GOOGLE_DRIVE_FOLDER_ID || '').trim();
  const credentialFile = String(env.GOOGLE_APPLICATION_CREDENTIALS || '').trim();
  if (!/^[A-Za-z0-9_-]{10,255}$/.test(folderId)) {
    throw codedError('DRIVE_NOT_CONFIGURED', 'GOOGLE_DRIVE_FOLDER_ID no está configurado correctamente.');
  }
  if (!credentialFile) {
    throw codedError('DRIVE_NOT_CONFIGURED', 'GOOGLE_APPLICATION_CREDENTIALS no está configurado.');
  }
  const absoluteCredentialFile = path.resolve(credentialFile);
  if (!fs.existsSync(absoluteCredentialFile) || !fs.statSync(absoluteCredentialFile).isFile()) {
    throw codedError('DRIVE_NOT_CONFIGURED', 'El archivo local de credenciales de Drive no está disponible.');
  }
  let credentials;
  try {
    credentials = JSON.parse(fs.readFileSync(absoluteCredentialFile, 'utf8'));
  } catch {
    throw codedError('DRIVE_CREDENTIALS_INVALID', 'El archivo local de credenciales de Drive no contiene JSON válido.');
  }
  if (
    credentials.type !== 'service_account'
    || typeof credentials.client_email !== 'string'
    || typeof credentials.private_key !== 'string'
  ) {
    throw codedError('DRIVE_CREDENTIALS_INVALID', 'Se requiere una clave JSON válida de cuenta de servicio.');
  }
  const { google } = require('googleapis');
  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: [GOOGLE_READ_SCOPE]
  });
  return { client: google.drive({ version: 'v3', auth }), folderId };
}

function createIngestionAgent({
  env = process.env,
  driveClient,
  driveClientFactory = makeDefaultDriveClient,
  modelRegistry = initModels,
  connectionFactory = getConnection,
  embeddingService = { createEmbedding },
  tokenizerLoader,
  textExtractor = extractFileDocument
} = {}) {
  let configuredDrive;
  let tokenizerPromise;
  let activeSync;
  let folderId;

  function getDrive() {
    if (!configuredDrive) {
      const configured = driveClient ? { client: driveClient, folderId: env.GOOGLE_DRIVE_FOLDER_ID } : driveClientFactory(env);
      configuredDrive = configured.client;
      folderId = String(configured.folderId || '').trim();
      if (!/^[A-Za-z0-9_-]{10,255}$/.test(folderId)) {
        throw codedError('DRIVE_NOT_CONFIGURED', 'GOOGLE_DRIVE_FOLDER_ID no está configurado correctamente.');
      }
    }
    return configuredDrive;
  }

  async function getTokenizer() {
    if (!tokenizerPromise) {
      tokenizerPromise = (async () => {
        if (tokenizerLoader) return tokenizerLoader();
        const { AutoTokenizer, env: transformersEnv } = await import('@huggingface/transformers');
        transformersEnv.cacheDir = path.resolve(__dirname, '../../.cache/huggingface');
        return AutoTokenizer.from_pretrained(MODEL, { local_files_only: true });
      })().catch((error) => {
        tokenizerPromise = undefined;
        throw error;
      });
    }
    return tokenizerPromise;
  }

  function models() {
    return modelRegistry();
  }

  async function getFile(fileId) {
    const drive = getDrive();
    const response = await drive.files.get({
      fileId,
      fields: fileFields,
      supportsAllDrives: true
    });
    return response.data;
  }

  async function listFolderFiles() {
    const drive = getDrive();
    const pendingFolders = [folderId];
    const visitedFolders = new Set();
    const visitedFiles = new Set();
    const files = [];
    while (pendingFolders.length) {
      const currentFolder = pendingFolders.shift();
      if (visitedFolders.has(currentFolder)) continue;
      visitedFolders.add(currentFolder);
      let pageToken;
      do {
        const response = await drive.files.list({
          q: `'${currentFolder}' in parents and trashed = false`,
          fields: `nextPageToken,files(${fileFields})`,
          orderBy: 'name',
          pageSize: 1000,
          pageToken,
          supportsAllDrives: true,
          includeItemsFromAllDrives: true
        });
        for (const file of response.data.files || []) {
          if (file.mimeType === FOLDER_MIME) pendingFolders.push(file.id);
          else if (!file.trashed && !visitedFiles.has(file.id)) {
            visitedFiles.add(file.id);
            files.push(file);
          }
          if (files.length > MAX_DRIVE_FILES) throw codedError('DRIVE_FILE_LIMIT', 'La carpeta supera el límite de documentos por sincronización.');
        }
        pageToken = response.data.nextPageToken;
      } while (pageToken);
    }
    return files;
  }

  async function belongsToFolder(file) {
    const drive = getDrive();
    const queue = [...(file.parents || [])];
    const visited = new Set();
    while (queue.length) {
      const parentId = queue.shift();
      if (parentId === folderId) return true;
      if (!parentId || visited.has(parentId)) continue;
      visited.add(parentId);
      let response;
      try {
        response = await drive.files.get({
          fileId: parentId,
          fields: 'id,mimeType,parents,trashed',
          supportsAllDrives: true
        });
      } catch (error) {
        if (error.code === 404 || error.response?.status === 404) continue;
        throw error;
      }
      if (response.data?.mimeType === FOLDER_MIME && !response.data.trashed) {
        queue.push(...(response.data.parents || []));
      }
    }
    return false;
  }

  async function analyzeFile(file) {
    const kind = classifyFile(file);
    if (!kind) return { kind: null, blocked: 'UNSUPPORTED_FILE_TYPE' };
    if (Number(file.size) > MAX_FILE_BYTES) throw codedError('DRIVE_FILE_TOO_LARGE', 'El archivo supera el límite de ingesta.');
    const extracted = await textExtractor(getDrive(), file, kind);
    const document = typeof extracted === 'string' ? { text: extracted, pages: null } : extracted;
    const text = normalizeText(document?.text);
    if (!text) return { kind, blocked: 'EMPTY_DOCUMENT' };
    const pii = detectPersonalData(`${file.name || ''}\n${text}`);
    const contentHash = createHash('sha256').update(text, 'utf8').digest('hex');
    return { kind, text, pages: document.pages || null, contentHash, pii, version: contentHash.slice(0, 32) };
  }

  async function findApproval(fileId, contentHash) {
    const approval = await models().IngestionApproval.findOne({
      where: { drive_file_id: fileId, content_hash: contentHash }
    });
    if (!approval || !approval.category || !approval.legal_sources || !approval.data_reviewed || !approval.normative_reviewed) return null;
    let legalSources = approval.legal_sources;
    if (typeof legalSources === 'string') {
      try { legalSources = JSON.parse(legalSources); }
      catch { throw codedError('INVALID_INGESTION_APPROVAL', 'La aprobación documental tiene fuentes normativas inválidas.'); }
    }
    return {
      category: categorySchema.parse(approval.category),
      effective_date: approval.effective_date || null,
      legal_sources: normalizeOfficialSources(legalSources)
    };
  }

  async function invalidateVectorCache(transaction) {
    await models().VectorCacheState.increment('revision', {
      by: 1,
      where: { id: 1 },
      transaction
    });
    transaction.afterCommit?.(() => require('./vector-store.service').clearSearchCache());
  }

  async function removeChunks(documentId, transaction) {
    const chunkCount = await models().DocumentChunk.count({ where: { document_id: documentId }, transaction });
    if (chunkCount) await models().DocumentChunk.destroy({ where: { document_id: documentId }, transaction });
    return chunkCount;
  }

  async function savePending(file, analysis) {
    const registry = models();
    return connectionFactory().transaction(async (transaction) => {
      const document = await registry.Documento.findOne({
        where: { drive_file_id: file.id },
        transaction,
        lock: transaction.LOCK.UPDATE
      });
      const title = String(file.name || 'Documento sin título').slice(0, 250);
      const existingChunks = document
        ? await registry.DocumentChunk.count({ where: { document_id: document.id }, transaction })
        : 0;
      const changed = !document || document.estado !== 'PENDIENTE'
        || document.content_hash !== analysis.contentHash
        || document.titulo !== title
        || existingChunks > 0;
      if (!changed) return false;
      let target = document;
      if (!target) {
        target = await registry.Documento.create({
          id: randomUUID(),
          drive_file_id: file.id,
          titulo: title,
          version: analysis.version,
          estado: 'PENDIENTE',
          content_hash: analysis.contentHash,
          actualizado_en: new Date()
        }, { transaction });
      } else {
        await target.update({
          titulo: title,
          version: analysis.version,
          estado: 'PENDIENTE',
          content_hash: analysis.contentHash,
          actualizado_en: new Date()
        }, { transaction });
      }
      const removedChunks = await removeChunks(target.id, transaction);
      if (removedChunks || document?.estado === 'VALIDADO') await invalidateVectorCache(transaction);
      return true;
    });
  }

  async function excludeFile(file, reason) {
    const registry = models();
    const title = reason === 'PERSONAL_DATA'
      ? 'Documento excluido por posible dato personal'
      : 'Documento no disponible para ingesta';
    return connectionFactory().transaction(async (transaction) => {
      let document = await registry.Documento.findOne({
        where: { drive_file_id: file.id },
        transaction,
        lock: transaction.LOCK.UPDATE
      });
      const previousStatus = document?.estado;
      const existingChunks = document
        ? await registry.DocumentChunk.count({ where: { document_id: document.id }, transaction })
        : 0;
      const changed = !document || previousStatus !== 'ELIMINADO'
        || document.titulo !== title || existingChunks > 0;
      if (!changed) return false;
      const removedChunks = document ? await removeChunks(document.id, transaction) : 0;
      if (!document) {
        document = await registry.Documento.create({
          id: randomUUID(),
          drive_file_id: file.id,
          titulo: title,
          version: 'EXCLUIDO',
          estado: 'ELIMINADO',
          content_hash: null,
          actualizado_en: new Date()
        }, { transaction });
      } else {
        await document.update({
          titulo: title,
          version: 'EXCLUIDO',
          estado: 'ELIMINADO',
          content_hash: null,
          actualizado_en: new Date()
        }, { transaction });
      }
      if (removedChunks || previousStatus === 'VALIDADO') await invalidateVectorCache(transaction);
      return true;
    });
  }

  async function removeDriveDocument(fileId) {
    const registry = models();
    return connectionFactory().transaction(async (transaction) => {
      const document = await registry.Documento.findOne({
        where: { drive_file_id: fileId },
        transaction,
        lock: transaction.LOCK.UPDATE
      });
      if (!document) return false;
      const removedChunks = await removeChunks(document.id, transaction);
      if (document.estado === 'ELIMINADO' && !removedChunks) return false;
      await document.update({
        titulo: 'Documento eliminado de Drive',
        version: 'ELIMINADO',
        estado: 'ELIMINADO',
        content_hash: null,
        actualizado_en: new Date()
      }, { transaction });
      if (removedChunks || document.estado === 'VALIDADO') await invalidateVectorCache(transaction);
      return true;
    });
  }

  async function isAlreadyIndexed(fileId, analysis) {
    const document = await models().Documento.findOne({
      where: { drive_file_id: fileId, estado: 'VALIDADO', content_hash: analysis.contentHash }
    });
    if (!document) return false;
    const tokenizer = await getTokenizer();
    const expectedChunks = createChunks(tokenizer, analysis.text, analysis.pages);
    const indexedChunks = await models().DocumentChunk.findAll({
      attributes: ['chunk_index', 'content_hash'],
      where: { document_id: document.id, version: analysis.version, is_active: true, validation_status: 'VALIDADO' },
      order: [['chunk_index', 'ASC']]
    });
    return indexedChunks.length === expectedChunks.length && indexedChunks.every((chunk, index) => (
      chunk.chunk_index === index
      && chunk.content_hash === createHash('sha256').update(expectedChunks[index].content, 'utf8').digest('hex')
    ));
  }

  async function refreshIndexedMetadata(file, analysis, approval) {
    const registry = models();
    return connectionFactory().transaction(async (transaction) => {
      const document = await registry.Documento.findOne({
        where: { drive_file_id: file.id, estado: 'VALIDADO', content_hash: analysis.contentHash },
        transaction,
        lock: transaction.LOCK.UPDATE
      });
      if (!document) return false;
      const title = String(file.name || 'Documento sin título').slice(0, 250);
      const metadata = { source_type: approval.category, legal_sources: approval.legal_sources };
      const activeChunks = await registry.DocumentChunk.findAll({
        where: { document_id: document.id, version: analysis.version, is_active: true, validation_status: 'VALIDADO' },
        transaction
      });
      const changed = document.titulo !== title || activeChunks.some((chunk) => (
        chunk.title !== title
        || chunk.source_url !== (file.webViewLink || null)
        || chunk.category !== approval.category
        || chunk.effective_date !== approval.effective_date
        || JSON.stringify(chunk.metadata) !== JSON.stringify(metadata)
      ));
      if (!changed) return false;
      await document.update({ titulo: title, actualizado_en: new Date() }, { transaction });
      await registry.DocumentChunk.update({
        title,
        source_url: file.webViewLink || null,
        category: approval.category,
        effective_date: approval.effective_date,
        metadata
      }, {
        where: { document_id: document.id, version: analysis.version, is_active: true, validation_status: 'VALIDADO' },
        transaction
      });
      await invalidateVectorCache(transaction);
      return true;
    });
  }

  async function indexFile(file, analysis, approval) {
    const tokenizer = await getTokenizer();
    const chunks = createChunks(tokenizer, analysis.text, analysis.pages);
    const preparedChunks = [];
    for (const chunk of chunks) {
      const embedding = await embeddingService.createEmbedding(chunk.content, 'RETRIEVAL_DOCUMENT');
      preparedChunks.push({ ...chunk, embedding });
    }
    const currentFile = await getFile(file.id);
    if (
      currentFile.trashed
      || currentFile.modifiedTime !== file.modifiedTime
      || (file.version && currentFile.version !== file.version)
      || (file.md5Checksum && currentFile.md5Checksum !== file.md5Checksum)
    ) throw codedError('DOCUMENT_CHANGED', 'El documento cambió durante la preparación; vuelva a sincronizarlo.');
    const registry = models();
    return connectionFactory().transaction(async (transaction) => {
      let document = await registry.Documento.findOne({
        where: { drive_file_id: file.id },
        transaction,
        lock: transaction.LOCK.UPDATE
      });
      if (document?.estado === 'VALIDADO' && document.content_hash === analysis.contentHash) {
        const existingChunks = await registry.DocumentChunk.findAll({
          attributes: ['chunk_index', 'content_hash'],
          where: { document_id: document.id, version: analysis.version, is_active: true, validation_status: 'VALIDADO' },
          order: [['chunk_index', 'ASC']],
          transaction
        });
        const complete = existingChunks.length === preparedChunks.length && existingChunks.every((chunk, index) => (
          chunk.chunk_index === index
          && chunk.content_hash === createHash('sha256').update(preparedChunks[index].content, 'utf8').digest('hex')
        ));
        if (complete) return false;
      }
      if (!document) {
        document = await registry.Documento.create({
          id: randomUUID(),
          drive_file_id: file.id,
          titulo: String(file.name || 'Documento sin título').slice(0, 250),
          version: analysis.version,
          estado: 'VALIDADO',
          content_hash: analysis.contentHash,
          actualizado_en: new Date()
        }, { transaction });
      } else {
        await document.update({
          titulo: String(file.name || 'Documento sin título').slice(0, 250),
          version: analysis.version,
          estado: 'VALIDADO',
          content_hash: analysis.contentHash,
          actualizado_en: new Date()
        }, { transaction });
      }
      await removeChunks(document.id, transaction);
      await registry.DocumentChunk.bulkCreate(preparedChunks.map((chunk, index) => ({
        id: randomUUID(),
        document_id: document.id,
        drive_file_id: file.id,
        title: String(file.name || 'Documento sin título').slice(0, 250),
        content: chunk.content,
        section: chunk.section,
        page_number: chunk.page_number,
        chunk_index: index,
        version: analysis.version,
        source_url: file.webViewLink || null,
        category: approval.category,
        effective_date: approval.effective_date,
        content_hash: createHash('sha256').update(chunk.content, 'utf8').digest('hex'),
        embedding_model: MODEL,
        embedding: chunk.embedding,
        metadata: { source_type: approval.category, legal_sources: approval.legal_sources },
        validation_status: 'VALIDADO',
        is_active: true
      })), { transaction });
      await invalidateVectorCache(transaction);
      return true;
    });
  }

  async function processFile(file, controls) {
    if (!file || file.trashed || !(await belongsToFolder(file))) {
      return { changed: await removeDriveDocument(file?.id), status: 'ELIMINADO' };
    }
    const analysis = await analyzeFile(file);
    if (!analysis.kind) {
      return { changed: await removeDriveDocument(file.id), status: 'NO_COMPATIBLE' };
    }
    if (analysis.blocked === 'EMPTY_DOCUMENT') {
      return { changed: await savePending(file, { contentHash: '0'.repeat(64), version: '0'.repeat(32) }), status: 'PENDIENTE_TEXTO' };
    }
    if (analysis.pii) {
      return { changed: await excludeFile(file, 'PERSONAL_DATA'), status: 'EXCLUIDO_DATOS_PERSONALES' };
    }
    const approval = await findApproval(file.id, analysis.contentHash);
    const atLimit = controls.maxDocuments !== null && controls.indexed >= controls.maxDocuments;
    if (approval) {
      if (await isAlreadyIndexed(file.id, analysis)) {
        if (controls.maxDocuments !== null && controls.indexed < controls.maxDocuments) controls.indexed += 1;
        return { changed: await refreshIndexedMetadata(file, analysis, approval), status: 'SIN_CAMBIOS' };
      }
      if (!atLimit) {
        const changed = await indexFile(file, analysis, approval);
        if (changed) controls.indexed += 1;
        return { changed, status: changed ? 'INDEXADO' : 'SIN_CAMBIOS' };
      }
    }
    return {
      changed: await savePending(file, analysis),
      status: approval && atLimit ? 'PENDIENTE_PILOTO' : 'PENDIENTE_VALIDACION_NORMATIVA'
    };
  }

  async function candidate(file) {
    const kind = classifyFile(file);
    if (!kind) return { driveFileId: file.id, status: 'NO_COMPATIBLE' };
    const analysis = await analyzeFile(file);
    if (analysis.pii) return { driveFileId: file.id, status: 'EXCLUIDO_DATOS_PERSONALES' };
    if (!analysis.text) return { driveFileId: file.id, status: 'PENDIENTE_TEXTO' };
    const approval = await findApproval(file.id, analysis.contentHash);
    return {
      driveFileId: file.id,
      title: String(file.name || 'Documento sin título').slice(0, 250),
      mimeType: file.mimeType,
      contentHash: analysis.contentHash,
      status: approval ? 'APROBADO_PARA_INGESTA' : 'PENDIENTE_VALIDACION_NORMATIVA'
    };
  }

  async function listCandidates() {
    const files = await listFolderFiles();
    const candidates = [];
    for (const file of files) candidates.push(await candidate(file));
    return candidates;
  }

  async function approveCandidate({
    driveFileId, contentHash, category, effectiveDate = null, legalSources, reviewerId,
    reviewedNoPersonalData, reviewedNormativeContent
  }) {
    const id = z.string().min(1).max(255).parse(driveFileId);
    const hash = z.string().regex(/^[a-f0-9]{64}$/).parse(contentHash);
    const parsedCategory = categorySchema.parse(category);
    const reviewer = z.string().uuid().parse(reviewerId);
    if (reviewedNoPersonalData !== true) throw codedError('PERSONAL_DATA_REVIEW_REQUIRED', 'RRHH debe confirmar que revisó el documento y no contiene datos personales.');
    if (reviewedNormativeContent !== true) throw codedError('NORMATIVE_REVIEW_REQUIRED', 'RRHH debe confirmar que revisó el contenido contra fuentes normativas oficiales vigentes.');
    const sources = normalizeOfficialSources(legalSources);
    const date = effectiveDate === null ? null : z.iso.date().parse(effectiveDate);
    let file;
    try {
      file = await getFile(id);
    } catch (error) {
      if (error.code === 404 || error.response?.status === 404) throw codedError('DRIVE_FILE_NOT_FOUND', 'No se encontró el documento en Drive.');
      throw error;
    }
    if (file.trashed || !(await belongsToFolder(file))) {
      throw codedError('DRIVE_FILE_OUTSIDE_FOLDER', 'El documento no pertenece a la carpeta configurada.');
    }
    const analysis = await analyzeFile(file);
    if (!analysis.kind) throw codedError('UNSUPPORTED_FILE_TYPE', 'El formato del documento no está admitido.');
    if (analysis.pii) throw codedError('PERSONAL_DATA_DETECTED', 'El documento se excluyó por posible dato personal.');
    if (analysis.contentHash !== hash) throw codedError('DOCUMENT_CHANGED', 'El documento cambió; actualice la lista antes de aprobarlo.');
    const registry = models();
    return connectionFactory().transaction(async (transaction) => {
      const existing = await registry.IngestionApproval.findOne({
        where: { drive_file_id: id, content_hash: hash },
        transaction,
        lock: transaction.LOCK.UPDATE
      });
      const values = {
        category: parsedCategory,
        effective_date: date,
        legal_sources: sources,
        data_reviewed: true,
        normative_reviewed: true,
        approved_by: reviewer,
        approved_at: new Date()
      };
      if (existing) {
        await existing.update(values, { transaction });
      } else {
        await registry.IngestionApproval.create({
          id: randomUUID(),
          drive_file_id: id,
          content_hash: hash,
          ...values
        }, { transaction });
      }
      return { driveFileId: id, contentHash: hash, status: 'APROBADO' };
    });
  }

  async function ensureIngestionState() {
    const registry = models();
    let state = await registry.DriveIngestionState.findByPk(folderId);
    if (state) return state;
    const response = await getDrive().changes.getStartPageToken({ supportsAllDrives: true });
    const startToken = response.data.startPageToken;
    if (!startToken) throw codedError('DRIVE_TOKEN_UNAVAILABLE', 'Drive no devolvió un token inicial de cambios.');
    state = await registry.DriveIngestionState.create({
      folder_id: folderId,
      bootstrap_token: startToken,
      cursor_token: startToken,
      pilot_done: false,
      initial_sync_done: false,
      updated_at: new Date()
    });
    return state;
  }

  async function applyChanges(pageToken, controls, counters) {
    let cursor = pageToken;
    let finalToken = pageToken;
    for (;;) {
      const response = await getDrive().changes.list({
        pageToken: cursor,
        fields: `nextPageToken,newStartPageToken,changes(fileId,removed,file(${fileFields}))`,
        pageSize: 1000,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true
      });
      const data = response.data;
      for (const change of data.changes || []) {
        counters.documentsRead += 1;
        const fileId = change.fileId || change.file?.id;
        if (!fileId) throw codedError('INVALID_DRIVE_CHANGE', 'Drive devolvió un cambio sin identificador de archivo.');
        if (change.removed || !change.file) {
          const removed = await removeDriveDocument(fileId);
          if (removed) {
            counters.documentsUpdated += 1;
            counters.deleted += 1;
          }
          continue;
        }
        if (change.file.mimeType === FOLDER_MIME) continue;
        const result = await processFile(change.file, controls);
        if (result.changed) counters.documentsUpdated += 1;
        if (result.status === 'ELIMINADO') counters.deleted += 1;
        if (result.status.startsWith('PENDIENTE')) counters.pending += 1;
        if (result.status === 'EXCLUIDO_DATOS_PERSONALES') counters.excluded += 1;
      }
      if (data.nextPageToken) {
        cursor = data.nextPageToken;
        continue;
      }
      finalToken = data.newStartPageToken || pageToken;
      break;
    }
    return finalToken;
  }

  async function processPendingDocuments(controls, counters) {
    const pending = await models().Documento.findAll({
      attributes: ['drive_file_id'],
      where: { estado: 'PENDIENTE' },
      order: [['drive_file_id', 'ASC']]
    });
    for (const document of pending) {
      if (controls.maxDocuments !== null && controls.indexed >= controls.maxDocuments) break;
      let file;
      try {
        file = await getFile(document.drive_file_id);
      } catch (error) {
        if (error.code === 404 || error.response?.status === 404) {
          if (await removeDriveDocument(document.drive_file_id)) {
            counters.documentsUpdated += 1;
            counters.deleted += 1;
          }
          continue;
        }
        throw error;
      }
      counters.documentsRead += 1;
      const result = await processFile(file, controls);
      if (result.changed) counters.documentsUpdated += 1;
      if (result.status.startsWith('PENDIENTE')) counters.pending += 1;
      if (result.status === 'EXCLUIDO_DATOS_PERSONALES') counters.excluded += 1;
    }
  }

  async function reconcileKnownDocuments(currentFileIds, counters) {
    const known = await models().Documento.findAll({
      attributes: ['drive_file_id'],
      where: { estado: { [Op.ne]: 'ELIMINADO' } }
    });
    for (const document of known) {
      if (currentFileIds.has(document.drive_file_id)) continue;
      if (await removeDriveDocument(document.drive_file_id)) {
        counters.documentsUpdated += 1;
        counters.deleted += 1;
      }
    }
  }

  async function runSync({ pilot = false, pilotFileId } = {}) {
    const counters = { documentsRead: 0, documentsUpdated: 0, indexed: 0, pending: 0, excluded: 0, deleted: 0 };
    const controls = { maxDocuments: pilot ? 1 : null, indexed: 0 };
    const registry = models();
    const syncRecord = await registry.Sincronizacion.create({
      id: randomUUID(),
      origen: 'GOOGLE_DRIVE',
      estado: 'EN_PROCESO',
      inicio_en: new Date(),
      finalizo_en: null,
      documentos_leidos: 0,
      documentos_actualizados: 0
    });
    try {
      getDrive();
      const state = await ensureIngestionState();
      if (!pilot && !state.pilot_done) throw codedError('PILOT_REQUIRED', 'Ejecute y verifique primero el piloto de un documento aprobado.');
      let cursor = state.cursor_token || state.bootstrap_token;
      if (pilot) {
        const id = z.string().trim().min(1).max(255).parse(pilotFileId);
        let file;
        try { file = await getFile(id); }
        catch (error) {
          if (error.code === 404 || error.response?.status === 404) throw codedError('DRIVE_FILE_NOT_FOUND', 'No se encontró el documento seleccionado en Drive.');
          throw error;
        }
        counters.documentsRead += 1;
        const result = await processFile(file, controls);
        if (result.changed) counters.documentsUpdated += 1;
        if (result.status.startsWith('PENDIENTE')) counters.pending += 1;
        if (result.status === 'EXCLUIDO_DATOS_PERSONALES') counters.excluded += 1;
        if (result.status === 'ELIMINADO') counters.deleted += 1;
      } else {
        if (!state.initial_sync_done) {
          for (const file of await listFolderFiles()) {
            counters.documentsRead += 1;
            const result = await processFile(file, controls);
            if (result.changed) counters.documentsUpdated += 1;
            if (result.status.startsWith('PENDIENTE')) counters.pending += 1;
            if (result.status === 'EXCLUIDO_DATOS_PERSONALES') counters.excluded += 1;
            if (result.status === 'ELIMINADO') counters.deleted += 1;
          }
        } else {
          await processPendingDocuments(controls, counters);
        }
        cursor = await applyChanges(cursor, controls, counters);
        const currentFiles = await listFolderFiles();
        await reconcileKnownDocuments(new Set(currentFiles.map((file) => file.id)), counters);
      }
      counters.indexed = controls.indexed;
      await state.update({
        cursor_token: pilot ? state.cursor_token : cursor,
        initial_sync_done: pilot ? state.initial_sync_done : true,
        pilot_done: state.pilot_done || (pilot && counters.indexed >= 1),
        updated_at: new Date()
      });
      await syncRecord.update({
        estado: 'COMPLETADA',
        finalizo_en: new Date(),
        documentos_leidos: counters.documentsRead,
        documentos_actualizados: counters.documentsUpdated
      });
      return { synchronizationId: syncRecord.id, mode: pilot ? 'PILOTO' : 'INCREMENTAL', ...counters };
    } catch (error) {
      try {
        await syncRecord.update({
          estado: 'FALLIDA',
          finalizo_en: new Date(),
          documentos_leidos: counters.documentsRead,
          documentos_actualizados: counters.documentsUpdated
        });
      } catch (recordError) {
        throw new AggregateError([error, recordError], 'Falló la sincronización y no se pudo registrar el error.');
      }
      throw error;
    }
  }

  function sync(options = {}) {
    if (activeSync) throw codedError('SYNC_IN_PROGRESS', 'Ya existe una sincronización de Drive en curso.');
    activeSync = runSync(options);
    return activeSync.finally(() => { activeSync = undefined; });
  }

  async function status() {
    const registry = models();
    const configuredFolderId = String(env.GOOGLE_DRIVE_FOLDER_ID || '').trim();
    const [state, lastSync, documents] = await Promise.all([
      configuredFolderId ? registry.DriveIngestionState.findByPk(configuredFolderId) : null,
      registry.Sincronizacion.findOne({ order: [['inicio_en', 'DESC']] }),
      registry.Documento.findAll({
        attributes: ['estado', [fn('COUNT', col('id')), 'count']],
        group: ['estado'],
        raw: true
      })
    ]);
    return {
      configured: Boolean(
        env.GOOGLE_DRIVE_FOLDER_ID
        && env.GOOGLE_APPLICATION_CREDENTIALS
        && fs.existsSync(path.resolve(env.GOOGLE_APPLICATION_CREDENTIALS))
      ),
      initialSyncComplete: Boolean(state?.initial_sync_done),
      pilotComplete: Boolean(state?.pilot_done),
      lastSynchronization: lastSync ? {
        id: lastSync.id,
        status: lastSync.estado,
        startedAt: lastSync.inicio_en,
        finishedAt: lastSync.finalizo_en,
        documentsRead: lastSync.documentos_leidos,
        documentsUpdated: lastSync.documentos_actualizados
      } : null,
      documentsByStatus: documents.reduce((result, item) => {
        result[item.estado] = Number(item.count || 0);
        return result;
      }, {})
    };
  }

  return {
    listCandidates,
    approveCandidate,
    sync: () => sync(),
    pilot: (driveFileId) => sync({ pilot: true, pilotFileId: driveFileId }),
    status
  };
}

const defaultAgent = createIngestionAgent();
module.exports = {
  GOOGLE_READ_SCOPE,
  MIN_CONTENT_TOKENS,
  MAX_CONTENT_TOKENS,
  OVERLAP_TOKENS,
  MAX_EMBEDDING_TOKENS,
  normalizeText,
  detectPersonalData,
  splitIntoSections,
  createChunks,
  normalizeOfficialSources,
  classifyFile,
  extractFileDocument,
  extractFileText,
  validateZipArchive,
  createIngestionAgent,
  ...defaultAgent
};
