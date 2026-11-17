'use strict';

const errorResponses = {
  400: { description: 'Entrada inválida' },
  401: { description: 'Credenciales o sesión inválidas' },
  403: { description: 'Rol sin autorización' },
  429: { description: 'Límite de intentos alcanzado' },
  500: { description: 'Error interno' }
};
const protectedGet = (summary) => ({ get: { summary, security: [{ bearerAuth: [] }], responses: { 200: { description: 'Consulta exitosa' }, ...errorResponses } } });

module.exports = {
  openapi: '3.0.3',
  info: { title: 'NexoTico API', version: '1.0.0', description: 'Autenticación y consultas de colaboradores.' },
  components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } },
  paths: {
    '/api/auth/login': { post: { summary: 'Iniciar sesión', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', additionalProperties: false, required: ['email', 'password'], properties: { email: { type: 'string', format: 'email' }, password: { type: 'string', format: 'password' } } } } } }, responses: { 200: { description: 'JWT y perfil de usuario' }, ...errorResponses } } },
    '/api/auth/me': protectedGet('Consultar sesión'),
    '/api/colaboradores/me': protectedGet('Consultar mi perfil'),
    '/api/colaboradores/me/vacaciones': protectedGet('Consultar mis saldos de vacaciones'),
    '/api/colaboradores/me/solicitudes': protectedGet('Consultar mis solicitudes'),
    '/api/colaboradores/me/proximo-pago': protectedGet('Consultar próximo pago programado'),
    '/api/colaboradores': protectedGet('Listar colaboradores; exclusivo RRHH')
  }
};
