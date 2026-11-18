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
    '/api/chat': { post: {
      summary: 'Enviar una consulta al orquestador de Recursos Humanos',
      security: [{ bearerAuth: [] }],
      requestBody: { required: true, content: { 'application/json': { schema: {
        type: 'object', additionalProperties: false, required: ['question', 'requestId'],
        properties: {
          question: { type: 'string', minLength: 1, maxLength: 4000 },
          requestId: { type: 'string', format: 'uuid', description: 'Clave idempotente estable para reintentos de esta solicitud.' },
          conversationId: { type: 'string', format: 'uuid', description: 'Omitir para iniciar una conversación nueva.' }
        }
      } } } },
      responses: {
        200: { description: 'Respuesta del agente correspondiente; citations solo contiene referencias documentales recuperadas', content: { 'application/json': { schema: {
          type: 'object',
          required: ['messageId', 'conversationId', 'answer', 'agent', 'intent', 'topic', 'agentsUsed', 'citations', 'resolved', 'clarificationNeeded', 'escalationSuggested', 'escalated', 'latencyMs'],
          properties: {
            messageId: { type: 'string', format: 'uuid' },
            conversationId: { type: 'string', format: 'uuid' },
            answer: { type: 'string' },
            agent: { type: 'string', enum: ['ORQUESTADOR'] },
            intent: { type: 'string', nullable: true, enum: ['POLITICA', 'DATO_PERSONAL', 'MIXTA', 'REPORTE', 'RESTRINGIDA', 'FUERA_DE_ALCANCE'] },
            topic: { type: 'string' },
            agentsUsed: { type: 'array', items: { type: 'string', enum: ['POLITICAS', 'DATOS_COLABORADOR'] } },
            fragmentsUsed: { type: 'array', items: { type: 'object' } },
            documentsCited: { type: 'array', items: { type: 'object' } },
            citations: { type: 'array', items: { type: 'object' } },
            resolved: { type: 'boolean' },
            clarificationNeeded: { type: 'boolean' },
            escalationSuggested: { type: 'boolean' },
            escalated: { type: 'boolean' },
            latencyMs: { type: 'integer', minimum: 0 }
          }
        } } } },
        400: { description: 'Pregunta inválida, ambigua o con campos no permitidos' },
        401: { description: 'Sesión inválida o ausente' },
        404: { description: 'Conversación no encontrada para este usuario' },
        409: { description: 'Clave de idempotencia duplicada con otra solicitud o consulta en proceso' },
        429: { description: 'Límite de consultas alcanzado' },
        503: { description: 'MySQL o DeepSeek no disponible' },
        ...errorResponses
      }
    } },
    '/api/chat/history': { get: {
      summary: 'Consultar el historial propio de mensajes',
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: 'conversationId', in: 'query', required: false, schema: { type: 'string', format: 'uuid' } },
        { name: 'limit', in: 'query', required: false, schema: { type: 'integer', minimum: 1, maximum: 100, default: 50 } }
      ],
      responses: { 200: { description: 'Mensajes del usuario autenticado' }, 401: { description: 'Sesión inválida o ausente' }, 404: { description: 'Conversación no encontrada para este usuario' }, ...errorResponses }
    } },
    '/api/chat/conversations': { get: {
      summary: 'Listar conversaciones propias',
      security: [{ bearerAuth: [] }],
      parameters: [{ name: 'limit', in: 'query', required: false, schema: { type: 'integer', minimum: 1, maximum: 100, default: 50 } }],
      responses: { 200: { description: 'Conversaciones ordenadas por actualización reciente' }, 401: { description: 'Sesión inválida o ausente' }, ...errorResponses }
    } },
    '/api/chat/conversations/{id}': { get: {
      summary: 'Consultar una conversación propia y sus mensajes',
      security: [{ bearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
      responses: { 200: { description: 'Conversación y mensajes del usuario autenticado' }, 400: { description: 'Identificador o límite inválido' }, 401: { description: 'Sesión inválida o ausente' }, 404: { description: 'Conversación no encontrada para este usuario' }, ...errorResponses }
    } },
    '/api/admin/ingestion/status': protectedGet('Consultar estado de la ingesta; exclusivo RRHH'),
    '/api/admin/ingestion/candidates': protectedGet('Listar documentos de Drive pendientes de revisión; exclusivo RRHH'),
    '/api/admin/departments': protectedGet('Consultar departamentos y conteo de colaboradores; exclusivo RRHH'),
    '/api/admin/requests': { get: { summary: 'Consultar solicitudes administrativas paginadas; exclusivo RRHH', security: [{ bearerAuth: [] }], parameters: [{ name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } }, { name: 'pageSize', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 200, default: 100 } }, { name: 'status', in: 'query', schema: { type: 'string', enum: ['PENDIENTE', 'APROBADA', 'RECHAZADA', 'CANCELADA'] } }, { name: 'department', in: 'query', schema: { type: 'string' } }, { name: 'search', in: 'query', schema: { type: 'string' } }], responses: { 200: { description: 'Solicitudes y metadatos de paginación' }, ...errorResponses } } },
    '/api/admin/documents': { get: { summary: 'Consultar documentos RAG indexados y fragmentos; exclusivo RRHH', security: [{ bearerAuth: [] }], parameters: [{ name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } }, { name: 'pageSize', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 200, default: 100 } }, { name: 'search', in: 'query', schema: { type: 'string' } }], responses: { 200: { description: 'Documentos validados e indexados con su enlace original' }, ...errorResponses } } },
    '/api/admin/synchronizations': { get: { summary: 'Consultar historial paginado de sincronizaciones; exclusivo RRHH', security: [{ bearerAuth: [] }], parameters: [{ name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } }, { name: 'pageSize', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 200, default: 100 } }], responses: { 200: { description: 'Sincronizaciones de Google Drive' }, ...errorResponses } } },
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
    '/api/admin/ingestion/sync': { post: { summary: 'Sincronizar cambios de Drive; exclusivo RRHH', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Resultado de sincronización' }, ...errorResponses } } },
    '/api/reports/latest': { get: { summary: 'Consultar el último reporte diario almacenado; exclusivo RRHH', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Reporte diario desde MySQL' }, 403: { description: 'Rol sin autorización' }, ...errorResponses } } },
    '/api/reports/history': { get: { summary: 'Consultar el historial de reportes almacenados; exclusivo RRHH', security: [{ bearerAuth: [] }], parameters: [{ name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 365, default: 30 } }], responses: { 200: { description: 'Historial de reportes' }, 403: { description: 'Rol sin autorización' }, ...errorResponses } } },
    '/api/reports/{date}': { get: { summary: 'Consultar el reporte almacenado para una fecha; exclusivo RRHH', security: [{ bearerAuth: [] }], parameters: [{ name: 'date', in: 'path', required: true, schema: { type: 'string', format: 'date' } }], responses: { 200: { description: 'Reporte solicitado' }, 404: { description: 'No existe reporte para la fecha' }, 403: { description: 'Rol sin autorización' }, ...errorResponses } } },
    '/api/reports/generate': { post: { summary: 'Generar o recuperar el reporte del día actual; exclusivo RRHH', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Reporte almacenado; la fecha es idempotente' }, 403: { description: 'Rol sin autorización' }, ...errorResponses } } }
  }
};
