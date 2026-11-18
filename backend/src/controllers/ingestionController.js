'use strict';

const HttpError = require('../utils/httpError');

const statusByCode = {
  DRIVE_NOT_CONFIGURED: 503,
  DRIVE_CREDENTIALS_INVALID: 503,
  DRIVE_TOKEN_UNAVAILABLE: 503,
  INVALID_DRIVE_RESPONSE: 502,
  INVALID_DRIVE_CHANGE: 502,
  DRIVE_FILE_LIMIT: 413,
  DRIVE_FILE_NOT_FOUND: 404,
  DRIVE_FILE_OUTSIDE_FOLDER: 404,
  DOCUMENT_CHANGED: 409,
  SYNC_IN_PROGRESS: 409,
  PERSONAL_DATA_DETECTED: 422,
  UNSUPPORTED_FILE_TYPE: 422,
  DRIVE_FILE_TOO_LARGE: 413,
  UNTRUSTED_LEGAL_SOURCE: 400,
  PERSONAL_DATA_REVIEW_REQUIRED: 400,
  NORMATIVE_REVIEW_REQUIRED: 400,
  INVALID_ARCHIVE: 422,
  ARCHIVE_LIMIT_EXCEEDED: 422,
  PILOT_REQUIRED: 409,
  EMBEDDING_TOKEN_LIMIT: 422
};

function createIngestionController(agent) {
  async function call(action) {
    try {
      return await action();
    } catch (error) {
      if (error instanceof HttpError) throw error;
      if (error.name === 'ZodError') throw new HttpError(400, 'Datos de ingesta inválidos.');
      if (statusByCode[error.code]) throw new HttpError(statusByCode[error.code], error.message);
      throw error;
    }
  }

  return {
    candidates: async (_req, res) => res.json({ candidates: await call(() => agent.listCandidates()) }),
    approve: async (req, res) => res.status(201).json({
      approval: await call(() => agent.approveCandidate({ ...req.validatedBody, reviewerId: req.user.id }))
    }),
    pilot: async (req, res) => res.json(await call(() => agent.pilot(req.validatedBody.driveFileId))),
    sync: async (_req, res) => res.json(await call(() => agent.sync())),
    status: async (_req, res) => res.json(await call(() => agent.status()))
  };
}

module.exports = { createIngestionController };
