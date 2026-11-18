'use strict';

const { z } = require('zod');
const HttpError = require('../utils/httpError');

const pageQuery = {
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(100)
};
const requestsQuerySchema = z.strictObject({
  ...pageQuery,
  status: z.enum(['PENDIENTE', 'APROBADA', 'RECHAZADA', 'CANCELADA']).optional(),
  department: z.string().trim().min(1).max(100).optional(),
  search: z.string().trim().max(100).optional(),
  sortBy: z.enum(['CREATED_AT', 'START_DATE', 'STATUS', 'TYPE', 'EMPLOYEE']).default('CREATED_AT'),
  direction: z.enum(['ASC', 'DESC']).default('DESC')
});
const pagedQuerySchema = z.strictObject({ ...pageQuery, search: z.string().trim().max(100).optional(), status: z.enum(['VALIDADO']).optional() });
const syncQuerySchema = z.strictObject(pageQuery);

function createAdminReadController(repository) {
  async function call(action) {
    try { return await action(); }
    catch (error) {
      if (error instanceof HttpError) throw error;
      if (error.code === 'DATABASE_NOT_CONFIGURED' || error.name?.startsWith('SequelizeConnection') || ['ECONNREFUSED', 'ETIMEDOUT', 'ER_ACCESS_DENIED_ERROR'].includes(error.code)) {
        throw new HttpError(503, 'Las consultas administrativas no están disponibles temporalmente.');
      }
      throw error;
    }
  }

  function parse(schema, query, message) {
    const result = schema.safeParse(query);
    if (!result.success) throw new HttpError(400, message);
    return result.data;
  }

  return {
    departments: async (_req, res) => res.json({ departments: await call(() => repository.listDepartments()) }),
    requests: async (req, res) => {
      const query = parse(requestsQuerySchema, req.query, 'Los filtros de solicitudes no son válidos.');
      res.json(await call(() => repository.listRequests(query)));
    },
    documents: async (req, res) => {
      const query = parse(pagedQuerySchema, req.query, 'Los filtros de documentos no son válidos.');
      res.json(await call(() => repository.listIndexedDocuments(query)));
    },
    synchronizations: async (req, res) => {
      const query = parse(syncQuerySchema, req.query, 'Los filtros de sincronizaciones no son válidos.');
      res.json(await call(() => repository.listSynchronizations(query)));
    }
  };
}

module.exports = { createAdminReadController, requestsQuerySchema, pagedQuerySchema, syncQuerySchema };
