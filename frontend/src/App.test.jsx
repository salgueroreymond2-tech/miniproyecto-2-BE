import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { App } from './App';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './components/ui/ToastProvider';
import { api, SESSION_EXPIRED_EVENT, setToken } from './services/api';

const USER_ID = '00000000-0000-4000-8000-000000000001';
const CONVERSATION_ID = '10000000-0000-4000-8000-000000000001';
const MESSAGE_ID = '20000000-0000-4000-8000-000000000001';
const reportFixture = {
  reportDate: '2026-11-17', storedAt: '2026-11-17T13:00:00.000Z',
  indicators: { activeCollaborators: 50, absentCollaboratorsToday: 2, pendingRequests: 3, activeIncapacities: 1, vacationBalancesOver20: 4 },
  absences: { byTypeDepartment: [{ type: 'INCAPACIDAD', department: 'Tecnología', collaborators: 1 }, { type: 'VACACIONES', department: 'Operaciones', collaborators: 1 }], totalPeople: 2, trend30Days: Array.from({ length: 30 }, (_, index) => ({ date: new Date(Date.UTC(2026, 9, 19 + index)).toISOString().slice(0, 10), collaborators: index % 3 })) },
  requests: { pendingCount: 3, olderThanThreeDaysCount: 1, pendingRows: [{ id: MESSAGE_ID, code: 'NT-001', name: 'Ana Vargas', department: 'Operaciones', type: 'VACACIONES', requestedDays: 2, startDate: '2026-12-01', endDate: '2026-12-02', createdAt: '2026-11-12T10:00:00.000Z', daysWithoutResponse: 5 }], byStatus: [{ status: 'PENDIENTE', count: 3 }, { status: 'APROBADA', count: 5 }] },
  incapacities: { activeCount: 1, activeCollaborators: 1, daysMonthToDate: 5 },
  turnover: { month: { hires: 1, exits: 0 }, yearToDate: { openingHeadcount: 49, currentHeadcount: 50, distinctExits: 2, ratePercent: 4 } },
  vacations: { over20DaysCount: 4, collaborators: [] },
  chatbot: { previousDay: '2026-11-16', totalQueries: 12, resolvedWithoutEscalation: 10, percentResolvedWithoutEscalation: 83.33, averageLatencyMs: 230, topTopics: [{ topic: 'VACACIONES', count: 5 }], ragUnansweredQuestions: [{ question: '¿La empresa ofrece un beneficio para mascotas?', intent: 'POLITICA', createdAt: '2026-11-16T15:00:00.000Z' }] },
  charts: { absences30Days: [], requestsByStatus: [] },
  executiveSummary: { text: 'Resumen creado desde las cifras almacenadas.', sentences: ['Resumen guardado.', 'Sin cambios adicionales.', 'Fin del resumen.'], origin: 'SQL_FALLBACK' }
};
const archivedReportFixture = { ...reportFixture, reportDate: '2026-11-16', storedAt: '2026-11-16T13:00:00.000Z' };

function renderApp(path = '/login') {
  return render(<MemoryRouter initialEntries={[path]}><AuthProvider><ToastProvider><App /></ToastProvider></AuthProvider></MemoryRouter>);
}

function employeeUser(rol = 'COLABORADOR') {
  return { id: USER_ID, email: 'ana@nexotico.test', rol };
}

function responseFor(url, overrides = {}) {
  const defaults = {
    '/auth/me': { usuario: employeeUser() },
    '/colaboradores/me': { colaborador: { nombres: 'Ana María', apellidos: 'Vargas Solís', codigo: 'NT-001', departamento: 'Operaciones', puesto: 'Analista', modalidad: 'HIBRIDO', estado: 'ACTIVO', email_corporativo: 'ana@nexotico.test', fecha_ingreso: '2024-02-01' } },
    '/colaboradores/me/vacaciones': { saldos: [{ periodo_anual: 2026, dias_generados: '14.00', dias_disfrutados: '2.00', dias_disponibles: '12.00' }] },
    '/colaboradores/me/solicitudes': { solicitudes: [{ id: MESSAGE_ID, tipo: 'VACACIONES', fecha_inicio: '2026-12-01', fecha_fin: '2026-12-02', dias_solicitados: '2.00', estado: 'PENDIENTE', creado_en: '2026-11-01T10:00:00Z' }] },
    '/colaboradores/me/proximo-pago': { proximoPago: { fecha_pago: '2026-11-30', fecha_corte_inicio: '2026-11-16', fecha_corte_fin: '2026-11-30', tipo: 'QUINCENA_2' } },
    '/colaboradores': { colaboradores: [{ codigo: 'NT-001', nombres: 'Ana María', apellidos: 'Vargas Solís', departamento: 'Operaciones', puesto: 'Analista', estado: 'ACTIVO' }] },
    '/chat/conversations': { conversations: [] },
    '/chat/history': { messages: [] },
    '/reports/latest': { report: reportFixture },
    '/reports/history': { reports: [reportFixture, archivedReportFixture] },
    '/reports/2026-11-17': { report: reportFixture },
    '/admin/departments': { departments: [{ id: 'dept-1', name: 'Operaciones', collaborators: 20, activeCollaborators: 19 }] },
    '/admin/requests': { items: [], pagination: { page: 1, pageSize: 200, total: 0, totalPages: 0 } },
    '/admin/documents': { items: [], pagination: { page: 1, pageSize: 200, total: 0, totalPages: 0 } },
    '/admin/synchronizations': { items: [], pagination: { page: 1, pageSize: 100, total: 0, totalPages: 0 } },
    '/admin/ingestion/status': { configured: true, initialSyncComplete: true, pilotComplete: true, lastSynchronization: null, documentsByStatus: {} }
  };
  return { data: { ...(defaults[url] || {}), ...overrides } };
}

function mockAuthenticatedSession({ role = 'COLABORADOR', extras = {}, messages = [] } = {}) {
  setToken('jwt-de-prueba');
  vi.spyOn(api, 'get').mockImplementation(async (url) => {
    if (url === '/auth/me') return { data: { usuario: employeeUser(role) } };
    if (url.startsWith('/chat/conversations/')) return { data: { conversation: { id: CONVERSATION_ID, title: 'Conversación de RRHH', topic: 'VACACIONES', messages } } };
    return responseFor(url, extras[url] || {}).data ? responseFor(url, extras[url] || {}) : { data: {} };
  });
}

afterEach(() => {
  cleanup();
  setToken(null);
  window.sessionStorage.clear();
  vi.restoreAllMocks();
});

describe('autenticación y permisos de navegación', () => {
  for (const [rol, path, heading] of [['RRHH', '/rrhh', 'Panel de RRHH'], ['COLABORADOR', '/mi-portal', 'Hola, Ana']]) {
    it(`redirige al área de ${rol} después del login`, async () => {
      vi.spyOn(api, 'post').mockResolvedValue({ data: { token: 'token-prueba', usuario: employeeUser(rol) } });
      vi.spyOn(api, 'get').mockImplementation(async (url) => responseFor(url));
      const user = userEvent.setup();
      renderApp();
      await user.type(screen.getByLabelText('Correo corporativo'), 'ana@nexotico.test');
      await user.type(screen.getByLabelText('Contraseña'), 'clave-de-prueba');
      await user.click(screen.getByRole('button', { name: /iniciar sesión/i }));
      expect(await screen.findByRole('heading', { name: heading }, { timeout: 10000 })).toBeInTheDocument();
    }, 15000);
  }

  it('valida formato de correo y permite mostrar u ocultar la contraseña', async () => {
    const loginRequest = vi.spyOn(api, 'post');
    const user = userEvent.setup();
    renderApp();
    await user.type(screen.getByLabelText('Correo corporativo'), 'correo-inválido');
    await user.type(screen.getByLabelText('Contraseña'), 'clave-prueba');
    await user.click(screen.getByRole('button', { name: /iniciar sesión/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('correo corporativo válido');
    expect(loginRequest).not.toHaveBeenCalled();
    const password = screen.getByLabelText('Contraseña');
    await user.click(screen.getByRole('button', { name: 'Mostrar contraseña' }));
    expect(password).toHaveAttribute('type', 'text');
    await user.click(screen.getByRole('button', { name: 'Ocultar contraseña' }));
    expect(password).toHaveAttribute('type', 'password');
  });

  it('restaura la sesión luego de recargar y regresa al login al vencer el token', async () => {
    mockAuthenticatedSession();
    renderApp('/');
    expect(await screen.findByRole('heading', { name: 'Hola, Ana' })).toBeInTheDocument();
    expect(api.defaults.headers.common.Authorization).toBe('Bearer jwt-de-prueba');
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    expect(await screen.findByRole('heading', { name: 'Bienvenido de nuevo' })).toBeInTheDocument();
    expect(window.sessionStorage.getItem('nexotico.session.token')).toBeNull();
  });

  it('no permite abrir el área RRHH con el rol de colaborador', async () => {
    mockAuthenticatedSession();
    renderApp('/rrhh');
    expect(await screen.findByRole('heading', { name: 'Hola, Ana' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Panel de RRHH' })).not.toBeInTheDocument();
  });

  it('carga el panel desde reportes guardados y permite consultar las vistas administrativas', async () => {
    mockAuthenticatedSession({ role: 'RRHH', extras: { '/admin/requests': { items: [{ id: 'request-1', code: 'NT-001', firstName: 'Ana', lastName: 'Vargas', department: 'Operaciones', type: 'VACACIONES', startDate: '2026-12-01', endDate: '2026-12-02', requestedDays: 2, status: 'PENDIENTE', createdAt: new Date(Date.now() - 5 * 86400000).toISOString() }], pagination: { page: 1, pageSize: 200, total: 1, totalPages: 1 } } } });
    renderApp('/rrhh');
    expect(await screen.findByRole('heading', { name: 'Panel de RRHH' }, { timeout: 10000 })).toBeInTheDocument();
    expect(await screen.findByText('50')).toBeInTheDocument();
    expect(screen.getByText('Resumen creado desde las cifras almacenadas.')).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/reports/latest');
    expect(api.get).toHaveBeenCalledWith('/reports/history', { params: { limit: 60 } });
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText('Reporte'), '2026-11-16');
    expect(screen.getByText(/Fuente: MySQL/)).toBeInTheDocument();
    expect(screen.getAllByText(/16 nov 2026/).length).toBeGreaterThan(0);
    await user.click(screen.getByRole('link', { name: 'Colaboradores' }));
    expect(await screen.findByRole('heading', { name: 'Directorio de colaboradores' }, { timeout: 10000 })).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Dashboard general' }));
    expect(await screen.findByRole('heading', { name: 'Panel de RRHH' }, { timeout: 10000 })).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Departamentos' }));
    expect(await screen.findByRole('heading', { name: 'Departamentos' }, { timeout: 10000 })).toBeInTheDocument();
    expect(await screen.findByText('Operaciones')).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Solicitudes' }));
    expect(await screen.findByRole('heading', { name: 'Solicitudes' }, { timeout: 10000 })).toBeInTheDocument();
    expect((await screen.findAllByText(/días sin respuesta/i)).length).toBeGreaterThan(1);
    await user.click(screen.getByRole('link', { name: 'Documentos indexados' }));
    expect(await screen.findByRole('heading', { name: 'Documentos indexados' }, { timeout: 10000 })).toBeInTheDocument();
    const sync = vi.spyOn(api, 'post').mockResolvedValue({ data: { documentsUpdated: 2 } });
    await user.click(screen.getByRole('button', { name: 'Sincronizar Drive' }));
    expect(await screen.findByRole('dialog', { name: 'Sincronizar Google Drive' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Iniciar sincronización' }));
    expect(await screen.findByRole('status')).toHaveTextContent(/2 documentos actualizados/i);
    expect(sync).toHaveBeenCalledWith('/admin/ingestion/sync', {});
    await user.click(screen.getByRole('link', { name: 'Sincronizaciones' }));
    expect(await screen.findByRole('heading', { name: 'Sincronizaciones' }, { timeout: 10000 })).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Actividad del chatbot' }));
    expect(await screen.findByRole('heading', { name: 'Actividad del chatbot' }, { timeout: 10000 })).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Historial de reportes' }));
    expect(await screen.findByRole('heading', { name: 'Historial de reportes' }, { timeout: 10000 })).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/reports/history', { params: { limit: 365 } });
    expect(await screen.findByRole('option', { name: /16 nov 2026/ })).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Fecha del reporte'), '2026-11-16');
    expect(screen.getAllByText(/Fecha: 16 nov 2026/).length).toBeGreaterThan(0);
  }, 20000);
});

describe('portal del colaborador', () => {
  it('muestra el resumen personalizado con datos recibidos por la API', async () => {
    vi.spyOn(api, 'post').mockResolvedValue({ data: { token: 'token-prueba', usuario: employeeUser() } });
    vi.spyOn(api, 'get').mockImplementation(async (url) => responseFor(url));
    const user = userEvent.setup();
    renderApp();
    await user.type(screen.getByLabelText('Correo corporativo'), 'ana@nexotico.test');
    await user.type(screen.getByLabelText('Contraseña'), 'clave-de-prueba');
    await user.click(screen.getByRole('button', { name: /iniciar sesión/i }));
    expect(await screen.findByRole('heading', { name: 'Hola, Ana' })).toBeInTheDocument();
    expect(screen.getByText('Operaciones')).toBeInTheDocument();
    expect(screen.getByText('Pendiente')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /mi perfil/i }).length).toBeGreaterThan(0);
    expect(api.get).toHaveBeenCalledWith('/colaboradores/me');
    expect(api.get).toHaveBeenCalledWith('/colaboradores/me/vacaciones');
    expect(api.get).toHaveBeenCalledWith('/colaboradores/me/solicitudes');
    expect(api.get).toHaveBeenCalledWith('/colaboradores/me/proximo-pago');
  });

  it('navega al perfil, vacaciones, solicitudes y pagos consultando sus endpoints', async () => {
    mockAuthenticatedSession();
    renderApp('/mi-portal');
    const user = userEvent.setup();
    await screen.findByRole('heading', { name: 'Bienvenido a tu portal' });
    await user.click(screen.getByRole('link', { name: 'Mi perfil' }));
    expect(await screen.findByRole('heading', { name: 'Mi perfil' })).toBeInTheDocument();
    expect(await screen.findByText('Ana María Vargas Solís')).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Mis vacaciones' }));
    expect(await screen.findByRole('heading', { name: 'Mis vacaciones' })).toBeInTheDocument();
    expect((await screen.findAllByText('12')).length).toBeGreaterThan(0);
    await user.click(screen.getByRole('link', { name: 'Mis solicitudes' }));
    expect(await screen.findByRole('heading', { name: 'Mis solicitudes' })).toBeInTheDocument();
    expect(await screen.findByText('Vacaciones')).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Próximos pagos' }));
    expect(await screen.findByRole('heading', { name: 'Próximos pagos' })).toBeInTheDocument();
    expect(await screen.findByText(/30 nov 2026/i)).toBeInTheDocument();
  });

  it('filtra solicitudes por el estado devuelto por MySQL', async () => {
    mockAuthenticatedSession({ extras: { '/colaboradores/me/solicitudes': { solicitudes: [
      { id: MESSAGE_ID, tipo: 'VACACIONES', fecha_inicio: '2026-12-01', fecha_fin: '2026-12-02', dias_solicitados: '2', estado: 'PENDIENTE' },
      { id: CONVERSATION_ID, tipo: 'PERMISO_PERSONAL', fecha_inicio: '2026-10-01', fecha_fin: '2026-10-01', dias_solicitados: '1', estado: 'APROBADA' }
    ] } } });
    renderApp('/mi-portal/solicitudes');
    expect(await screen.findByText('Permiso Personal')).toBeInTheDocument();
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText('Filtrar por estado'), 'PENDIENTE');
    expect(screen.getByText('Pendiente')).toBeInTheDocument();
    expect(screen.queryByText('Aprobada')).not.toBeInTheDocument();
  });
});

describe('generación administrativa de reportes', () => {
  it('envía la solicitud al endpoint existente y muestra el reporte generado', async () => {
    mockAuthenticatedSession({ role: 'RRHH' });
    const generate = vi.spyOn(api, 'post').mockResolvedValue({ data: { report: reportFixture, created: true, reused: false } });
    const user = userEvent.setup();
    renderApp('/rrhh/reportes');
    expect(await screen.findByRole('heading', { name: 'Historial de reportes' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Generar reporte de hoy' }));
    expect(generate).toHaveBeenCalledWith('/reports/generate', {});
    expect(await screen.findByRole('status')).toHaveTextContent('Reporte generado y guardado.');
    expect(screen.getByText('Resumen creado desde las cifras almacenadas.')).toBeInTheDocument();
  });
});

describe('asistente inteligente', () => {
  const citation = { reference: 1, title: 'Política de vacaciones', section: 'Acumulación', version: '1.0', page: 4, link: 'https://drive.google.com/file/d/documento-ficticio/view' };
  const savedMessage = { id: MESSAGE_ID, conversationId: CONVERSATION_ID, question: '¿Qué dice la política de vacaciones?', answer: 'La política describe las condiciones documentadas. **Revisa la sección indicada.**', intent: 'POLITICA', topic: 'VACACIONES', agentsUsed: ['POLITICAS'], citations: [citation], documentsCited: [], resolved: true, escalationSuggested: false, createdAt: '2026-11-01T10:00:00Z' };

  it('restaura la conversación desde la API y presenta citas con enlace seguro a Drive', async () => {
    mockAuthenticatedSession({ extras: {
      '/chat/conversations': { conversations: [{ id: CONVERSATION_ID, title: 'Conversación de RRHH', topic: 'VACACIONES', updatedAt: '2026-11-01T10:00:00Z' }] },
      '/chat/history': { messages: [{ ...savedMessage, conversationId: null, question: 'Consulta antigua de políticas' }] }
    }, messages: [savedMessage] });
    renderApp('/mi-portal/asistente');
    expect(await screen.findByText('¿Qué dice la política de vacaciones?')).toBeInTheDocument();
    expect(screen.getByText('Revisa la sección indicada.')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /abrir política de vacaciones en google drive/i });
    expect(link).toHaveAttribute('href', citation.link);
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(api.get).toHaveBeenCalledWith('/chat/history', { params: {} });
    expect(api.get).toHaveBeenCalledWith(`/chat/conversations/${CONVERSATION_ID}`);
    await userEvent.setup().click(screen.getByRole('button', { name: /consultas anteriores/i }));
    expect(await screen.findByText('Consulta antigua de políticas')).toBeInTheDocument();
  });

  it('envía consultas personales sin recibir citas inventadas y muestra MySQL como fuente', async () => {
    mockAuthenticatedSession();
    vi.spyOn(api, 'post').mockResolvedValue({ data: {
      messageId: MESSAGE_ID, conversationId: CONVERSATION_ID, answer: 'Tienes **12 días disponibles**. Fuente de datos: MySQL.',
      agent: 'ORQUESTADOR', intent: 'DATO_PERSONAL', topic: 'VACACIONES', agentsUsed: ['DATOS_COLABORADOR'], citations: [],
      resolved: true, escalationSuggested: false, escalated: false, latencyMs: 10
    } });
    renderApp('/mi-portal/asistente');
    const user = userEvent.setup();
    const input = await screen.findByLabelText('Escribe tu consulta de Recursos Humanos');
    await user.type(input, '¿Cuántos días de vacaciones tengo?');
    await user.click(screen.getByRole('button', { name: 'Enviar consulta' }));
    expect(await screen.findByText('12 días disponibles')).toBeInTheDocument();
    expect(screen.getByText('Tus datos · MySQL')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Fuentes documentales' })).not.toBeInTheDocument();
    const [, body] = api.post.mock.calls[0];
    expect(body.question).toBe('¿Cuántos días de vacaciones tengo?');
    expect(body.requestId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(body.conversationId).toBeUndefined();
  });

  it('sanitiza Markdown peligroso y conserva el texto como contenido inerte', async () => {
    mockAuthenticatedSession();
    vi.spyOn(api, 'post').mockResolvedValue({ data: {
      messageId: MESSAGE_ID, conversationId: CONVERSATION_ID,
      answer: 'Texto seguro. <img src=x onerror=alert(1)> [enlace](javascript:alert(1))',
      agentsUsed: ['POLITICAS'], citations: [], resolved: true, escalationSuggested: false, latencyMs: 1
    } });
    renderApp('/mi-portal/asistente');
    const user = userEvent.setup();
    const input = await screen.findByLabelText('Escribe tu consulta de Recursos Humanos');
    await user.type(input, '¿Qué dice la política?');
    await user.click(screen.getByRole('button', { name: 'Enviar consulta' }));
    expect(await screen.findByText(/<img src=x onerror=alert\(1\)>/)).toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
    expect(document.querySelector('a[href^="javascript:"]')).toBeNull();
  });

  it('permite reintentar la consulta fallida con la misma clave idempotente', async () => {
    mockAuthenticatedSession();
    const post = vi.spyOn(api, 'post')
      .mockRejectedValueOnce({ response: { data: { error: 'DeepSeek no está disponible.' } } })
      .mockResolvedValueOnce({ data: {
        messageId: MESSAGE_ID, conversationId: CONVERSATION_ID, answer: 'Respuesta recuperada.',
        agentsUsed: ['POLITICAS'], citations: [], resolved: true, escalationSuggested: false, latencyMs: 11
      } });
    renderApp('/mi-portal/asistente');
    const user = userEvent.setup();
    const input = await screen.findByLabelText('Escribe tu consulta de Recursos Humanos');
    await user.type(input, '¿Cómo solicito un permiso?');
    await user.click(screen.getByRole('button', { name: 'Enviar consulta' }));
    expect(await screen.findByText('DeepSeek no está disponible.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Respuesta recuperada.')).toBeInTheDocument();
    expect(post).toHaveBeenCalledTimes(2);
    expect(post.mock.calls[0][1].requestId).toBe(post.mock.calls[1][1].requestId);
  });

  it('crea una conversación nueva y no envía el ID de la conversación anterior', async () => {
    mockAuthenticatedSession({ extras: { '/chat/conversations': { conversations: [{ id: CONVERSATION_ID, title: 'Anterior', topic: 'PAGOS' }] } }, messages: [savedMessage] });
    const post = vi.spyOn(api, 'post').mockResolvedValue({ data: {
      messageId: MESSAGE_ID, conversationId: '30000000-0000-4000-8000-000000000001', answer: 'Solicitud recibida.',
      agentsUsed: ['POLITICAS'], citations: [], resolved: true, escalationSuggested: false, latencyMs: 4
    } });
    renderApp('/mi-portal/asistente');
    const user = userEvent.setup();
    await screen.findByText('¿Qué dice la política de vacaciones?');
    await user.click(screen.getByRole('button', { name: 'Nueva conversación' }));
    await user.click(screen.getByRole('button', { name: /¿cómo puedo solicitar un permiso/i }));
    expect(await screen.findByText('Solicitud recibida.')).toBeInTheDocument();
    expect(post.mock.calls[0][1].conversationId).toBeUndefined();
  });
});
