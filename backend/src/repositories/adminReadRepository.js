'use strict';

const { getReadConnection } = require('../config/database');
const { initModels } = require('../models');

const REQUEST_SORT = Object.freeze({
  CREATED_AT: 'createdAt', START_DATE: 'startDate', STATUS: 'status', TYPE: 'type', EMPLOYEE: 'lastName'
});

function createAdminReadRepository({ connectionFactory = getReadConnection, modelsFactory = initModels } = {}) {
  function models() { return modelsFactory(connectionFactory()); }

  async function listRequests({ page = 1, pageSize = 20, status, department, search, sortBy = 'CREATED_AT', direction = 'DESC' } = {}) {
    const m = models();
    const where = status ? { estado: status } : {};
    const rows = await m.Solicitud.findAll({
      where,
      attributes: ['id', 'tipo', 'fecha_inicio', 'fecha_fin', 'dias_solicitados', 'estado', 'creado_en'],
      include: [{ model: m.Colaborador, attributes: ['codigo', 'nombres', 'apellidos'], required: true,
        include: [{ model: m.Departamento, attributes: ['nombre'], required: true }] }],
      raw: true, nest: true
    });
    const term = String(search || '').trim().toLocaleLowerCase('es');
    let items = rows.map((row) => ({
      id: row.id, code: row.Colaborador.codigo, firstName: row.Colaborador.nombres, lastName: row.Colaborador.apellidos,
      department: row.Colaborador.Departamento.nombre, type: row.tipo, startDate: row.fecha_inicio, endDate: row.fecha_fin,
      requestedDays: row.dias_solicitados, status: row.estado, createdAt: row.creado_en
    })).filter((row) => !department || row.department === department)
      .filter((row) => !term || `${row.code} ${row.firstName} ${row.lastName} ${row.department} ${row.type}`.toLocaleLowerCase('es').includes(term));
    const field = REQUEST_SORT[sortBy] || REQUEST_SORT.CREATED_AT;
    const multiplier = String(direction).toUpperCase() === 'ASC' ? 1 : -1;
    const dateSort = ['createdAt', 'startDate'].includes(field);
    items.sort((a, b) => {
      const primary = dateSort
        ? (new Date(a[field]).getTime() - new Date(b[field]).getTime())
        : String(a[field] ?? '').localeCompare(String(b[field] ?? ''), 'es');
      return primary * multiplier || String(a.id).localeCompare(String(b.id));
    });
    const total = items.length;
    const offset = (Math.max(1, Number(page) || 1) - 1) * Math.max(1, Math.min(200, Number(pageSize) || 20));
    const size = Math.max(1, Math.min(200, Number(pageSize) || 20));
    return { items: items.slice(offset, offset + size), pagination: { page: Math.max(1, Number(page) || 1), pageSize: size, total, totalPages: Math.ceil(total / size) } };
  }

  async function listDepartments() {
    const m = models();
    const rows = await m.Departamento.findAll({
      attributes: ['id', 'nombre'],
      include: [{ model: m.Colaborador, attributes: ['id', 'estado'], required: false }],
      order: [['nombre', 'ASC']], raw: true, nest: true
    });
    const departments = new Map();
    for (const row of rows) {
      if (!departments.has(row.id)) departments.set(row.id, { id: row.id, name: row.nombre, collaborators: 0, activeCollaborators: 0 });
      const department = departments.get(row.id);
      if (row.Colaborador?.id) {
        department.collaborators += 1;
        if (row.Colaborador.estado === 'ACTIVO') department.activeCollaborators += 1;
      }
    }
    return [...departments.values()];
  }

  async function listIndexedDocuments({ page = 1, pageSize = 20, search } = {}) {
    const m = models();
    const chunks = await m.DocumentChunk.findAll({
      where: { is_active: true, validation_status: 'VALIDADO' },
      attributes: ['id', 'document_id', 'category', 'source_url', 'created_at'],
      include: [{ model: m.Documento, attributes: ['id', 'drive_file_id', 'titulo', 'version', 'estado'], where: { estado: 'VALIDADO' }, required: true }],
      order: [['created_at', 'ASC']], raw: true, nest: true
    });
    const grouped = new Map();
    for (const row of chunks) {
      const document = row.Documento;
      if (!document?.id) continue;
      if (!grouped.has(document.id)) grouped.set(document.id, {
        id: document.id, driveFileId: document.drive_file_id, title: document.titulo, version: document.version,
        status: document.estado, fragmentCount: 0, indexedAt: row.created_at, category: row.category, sourceUrl: row.source_url
      });
      const item = grouped.get(document.id);
      item.fragmentCount += 1;
      if (new Date(row.created_at) < new Date(item.indexedAt)) item.indexedAt = row.created_at;
    }
    const term = String(search || '').trim().toLocaleLowerCase('es');
    const items = [...grouped.values()].filter((item) => !term || item.title.toLocaleLowerCase('es').includes(term))
      .sort((a, b) => String(b.indexedAt).localeCompare(String(a.indexedAt)) || a.title.localeCompare(b.title, 'es'));
    const size = Math.max(1, Math.min(200, Number(pageSize) || 20));
    const currentPage = Math.max(1, Number(page) || 1);
    const offset = (currentPage - 1) * size;
    return { items: items.slice(offset, offset + size), pagination: { page: currentPage, pageSize: size, total: items.length, totalPages: Math.ceil(items.length / size) } };
  }

  async function listSynchronizations({ page = 1, pageSize = 20 } = {}) {
    const m = models();
    const size = Math.max(1, Math.min(200, Number(pageSize) || 20));
    const currentPage = Math.max(1, Number(page) || 1);
    const result = await m.Sincronizacion.findAndCountAll({
      attributes: ['id', 'origen', 'estado', 'inicio_en', 'finalizo_en', 'documentos_leidos', 'documentos_actualizados'],
      order: [['inicio_en', 'DESC']], limit: size, offset: (currentPage - 1) * size, raw: true
    });
    const items = result.rows.map((row) => ({ id: row.id, source: row.origen, status: row.estado, startedAt: row.inicio_en, finishedAt: row.finalizo_en, documentsRead: row.documentos_leidos, documentsUpdated: row.documentos_actualizados }));
    return { items, pagination: { page: currentPage, pageSize: size, total: result.count, totalPages: Math.ceil(result.count / size) } };
  }

  return { listRequests, listDepartments, listIndexedDocuments, listSynchronizations };
}

const defaultRepository = createAdminReadRepository();
module.exports = { REQUEST_SORT, createAdminReadRepository, ...defaultRepository };
