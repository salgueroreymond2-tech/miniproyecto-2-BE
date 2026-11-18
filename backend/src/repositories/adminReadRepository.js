'use strict';

const { QueryTypes } = require('sequelize');
const { getReadConnection } = require('../config/database');

const REQUEST_SORT = Object.freeze({
  CREATED_AT: 's.creado_en', START_DATE: 's.fecha_inicio', STATUS: 's.estado', TYPE: 's.tipo', EMPLOYEE: 'c.apellidos'
});

function createAdminReadRepository({ connectionFactory = getReadConnection } = {}) {
  function select(sql, replacements) {
    return connectionFactory().query(sql, { replacements, type: QueryTypes.SELECT });
  }

  async function listRequests({ page = 1, pageSize = 25, status, department, search, sortBy = 'CREATED_AT', direction = 'DESC' } = {}) {
    const clauses = [];
    const replacements = { limit: pageSize, offset: (page - 1) * pageSize };
    if (status) { clauses.push('s.estado = :status'); replacements.status = status; }
    if (department) { clauses.push('d.nombre = :department'); replacements.department = department; }
    if (search) {
      clauses.push('(c.codigo LIKE :search OR c.nombres LIKE :search OR c.apellidos LIKE :search OR s.tipo LIKE :search)');
      replacements.search = `%${search}%`;
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const orderBy = REQUEST_SORT[sortBy] || REQUEST_SORT.CREATED_AT;
    const orderDirection = direction === 'ASC' ? 'ASC' : 'DESC';
    const [items, countRows] = await Promise.all([
      select(`SELECT s.id, c.codigo AS code, c.nombres AS firstName, c.apellidos AS lastName, d.nombre AS department,
          s.tipo AS type, s.fecha_inicio AS startDate, s.fecha_fin AS endDate, s.dias_solicitados AS requestedDays,
          s.estado AS status, s.creado_en AS createdAt
        FROM solicitudes s JOIN colaboradores c ON c.id=s.colaborador_id JOIN departamentos d ON d.id=c.departamento_id
        ${where} ORDER BY ${orderBy} ${orderDirection}, s.id ASC LIMIT :limit OFFSET :offset`, replacements),
      select(`SELECT COUNT(*) AS total FROM solicitudes s JOIN colaboradores c ON c.id=s.colaborador_id JOIN departamentos d ON d.id=c.departamento_id ${where}`, replacements)
    ]);
    const total = Number(countRows[0]?.total || 0);
    return { items, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
  }

  async function listDepartments() {
    return select(`SELECT d.id, d.nombre AS name, COUNT(c.id) AS collaborators,
        SUM(CASE WHEN c.estado='ACTIVO' THEN 1 ELSE 0 END) AS activeCollaborators
      FROM departamentos d LEFT JOIN colaboradores c ON c.departamento_id=d.id
      GROUP BY d.id,d.nombre ORDER BY d.nombre`, {});
  }

  async function listIndexedDocuments({ page = 1, pageSize = 25, search, status } = {}) {
    const conditions = ["d.estado = 'VALIDADO'", "c.is_active = 1", "c.validation_status = 'VALIDADO'"];
    const replacements = { limit: pageSize, offset: (page - 1) * pageSize };
    if (search) { conditions.push('d.titulo LIKE :search'); replacements.search = `%${search}%`; }
    if (status && status !== 'VALIDADO') return { items: [], pagination: { page, pageSize, total: 0, totalPages: 0 } };
    const where = `WHERE ${conditions.join(' AND ')}`;
    const [items, countRows] = await Promise.all([
      select(`SELECT d.drive_file_id AS driveFileId, d.titulo AS title, d.version AS version,
          MIN(c.created_at) AS indexedAt, COUNT(DISTINCT c.id) AS fragmentCount, d.estado AS status,
          MAX(c.category) AS category, MAX(c.source_url) AS sourceUrl
        FROM documentos d JOIN document_chunks_e5 c ON c.document_id=d.id ${where}
        GROUP BY d.id,d.drive_file_id,d.titulo,d.version,d.estado
        ORDER BY indexedAt DESC,d.titulo ASC LIMIT :limit OFFSET :offset`, replacements),
      select(`SELECT COUNT(DISTINCT d.id) AS total FROM documentos d JOIN document_chunks_e5 c ON c.document_id=d.id ${where}`, replacements)
    ]);
    const total = Number(countRows[0]?.total || 0);
    return { items, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
  }

  async function listSynchronizations({ page = 1, pageSize = 25 } = {}) {
    const replacements = { limit: pageSize, offset: (page - 1) * pageSize };
    const [items, countRows] = await Promise.all([
      select(`SELECT id,origen AS source,estado AS status,inicio_en AS startedAt,finalizo_en AS finishedAt,
          documentos_leidos AS documentsRead,documentos_actualizados AS documentsUpdated
        FROM sincronizaciones ORDER BY inicio_en DESC LIMIT :limit OFFSET :offset`, replacements),
      select('SELECT COUNT(*) AS total FROM sincronizaciones', {})
    ]);
    const total = Number(countRows[0]?.total || 0);
    return { items, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
  }

  return { listRequests, listDepartments, listIndexedDocuments, listSynchronizations };
}

module.exports = { REQUEST_SORT, createAdminReadRepository };
