'use strict';

const errorResponses = {
  400: { description: 'Entrada inválida' },
  401: { description: 'Credenciales o sesión inválidas' },
  403: { description: 'Rol sin autorización' },
  429: { description: 'Límite de intentos alcanzado' },
  409: { description: 'Conflicto con el estado de la sincronización' },
  413: { description: 'Archivo demasiado grande' },
  422: { description: 'Formato o contenido no procesable' },
  502: { description: 'Respuesta inválida de Drive' },
  503: { description: 'Integración externa no configurada' },
  500: { description: 'Error interno' }
};
const protectedGet = (summary) => ({ get: { summary, security: [{ bearerAuth: [] }], responses: { 200: { description: 'Consulta exitosa' }, ...errorResponses } } });

module.exports = {
  openapi: '3.0.3',
  info: { title: 'NexoTico API', version: '1.0.0', description: 'Servicios autenticados de Recursos Humanos, ingesta documental y recuperación RAG.' },
  components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } },
  paths: {
    '/api/auth/login': { post: { summary: 'Iniciar sesión', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', additionalProperties: false, required: ['email', 'password'], properties: { email: { type: 'string', format: 'email' }, password: { type: 'string', format: 'password' } } } } } }, responses: { 200: { description: 'JWT y perfil de usuario' }, ...errorResponses } } },
    '/api/auth/me': protectedGet('Consultar sesión'),
    '/api/colaboradores/me': protectedGet('Consultar mi perfil'),
    '/api/colaboradores/me/vacaciones': protectedGet('Consultar mis saldos de vacaciones'),
    '/api/colaboradores/me/solicitudes': protectedGet('Consultar mis solicitudes'),
    '/api/colaboradores/me/proximo-pago': protectedGet('Consultar próximo pago programado'),
    '/api/colaboradores': protectedGet('Listar colaboradores; exclusivo RRHH'),
    '/api/chat/employee-data': { post: {
      summary: 'Consultar datos personales propios de Recursos Humanos',
      security: [{ bearerAuth: [] }],
      requestBody: { required: true, content: { 'application/json': { schema: {
        type: 'object', additionalProperties: false, required: ['question'],
        properties: { question: { type: 'string', minLength: 1, maxLength: 2000 } }
      } } } },
      responses: {
        200: { description: 'Respuesta basada en registros propios de MySQL; citations es una lista vacía', content: { 'application/json': { schema: {
          type: 'object',
          required: ['answer', 'agent', 'citations', 'resolved', 'escalationSuggested', 'escalated', 'latencyMs'],
          properties: {
            answer: { type: 'string' },
            agent: { type: 'string', enum: ['DATOS_COLABORADOR'] },
            citations: { type: 'array', maxItems: 0, items: { type: 'object' } },
            resolved: { type: 'boolean' },
            escalationSuggested: { type: 'boolean' },
            escalated: { type: 'boolean' },
            latencyMs: { type: 'integer', minimum: 0 }
          }
        } } } },
        400: { description: 'Pregunta inválida, ambigua o con campos no permitidos' },
        401: { description: 'Sesión inválida o ausente' },
        429: { description: 'Límite de consultas alcanzado' },
        503: { description: 'MySQL de solo lectura o DeepSeek no disponible' },
        ...errorResponses
      }
    } },
    '/api/admin/ingestion/status': protectedGet('Consultar estado de la ingesta; exclusivo RRHH'),
    '/api/admin/ingestion/candidates': protectedGet('Listar documentos de Drive pendientes de revisión; exclusivo RRHH'),
    '/api/admin/ingestion/approvals': { post: {
      summary: 'Aprobar un hash documental revisado y sus fuentes oficiales; exclusivo RRHH',
      security: [{ bearerAuth: [] }],
      requestBody: { required: true, content: { 'application/json': { schema: {
        type: 'object', additionalProperties: false,
        required: ['driveFileId', 'contentHash', 'category', 'legalSources', 'reviewedNoPersonalData', 'reviewedNormativeContent'],
        properties: {
          driveFileId: { type: 'string' },
          contentHash: { type: 'string', pattern: '^[a-f0-9]{64}$' },
          category: { type: 'string', enum: ['POLITICA', 'PROCEDIMIENTO', 'DOCUMENTO_PUBLICO'] },
          effectiveDate: { type: 'string', format: 'date', nullable: true },
          legalSources: { type: 'array', minItems: 1, maxItems: 10, items: { type: 'string', format: 'uri' } },
          reviewedNoPersonalData: { type: 'boolean', enum: [true], description: 'Atestación RRHH tras revisar el archivo en Drive.' },
          reviewedNormativeContent: { type: 'boolean', enum: [true], description: 'Atestación de revisión normativa mediante fuentes oficiales vigentes.' }
        }
      } } } },
      responses: { 201: { description: 'Documento aprobado para ingesta' }, ...errorResponses }
    } },
    '/api/admin/ingestion/pilot': { post: {
      summary: 'Procesar un documento aprobado seleccionado; exclusivo RRHH',
      security: [{ bearerAuth: [] }],
      requestBody: { required: true, content: { 'application/json': { schema: {
        type: 'object', additionalProperties: false, required: ['driveFileId'],
        properties: { driveFileId: { type: 'string', minLength: 1, maxLength: 255 } }
      } } } },
      responses: { 200: { description: 'Resultado del piloto' }, ...errorResponses }
    } },
    '/api/admin/ingestion/sync': { post: { summary: 'Sincronizar cambios de Drive; exclusivo RRHH', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Resultado de sincronización' }, ...errorResponses } } }
  }
};
