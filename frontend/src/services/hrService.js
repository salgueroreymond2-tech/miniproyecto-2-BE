import { api } from './api';

const payload = (promise, key) => promise.then(({ data }) => data[key]);

export const hrService = {
  auth: {
    login: (credentials) => api.post('/auth/login', credentials).then(({ data }) => data),
    me: () => payload(api.get('/auth/me'), 'usuario')
  },
  employee: {
    profile: () => payload(api.get('/colaboradores/me'), 'colaborador'),
    vacations: () => payload(api.get('/colaboradores/me/vacaciones'), 'saldos'),
    requests: () => payload(api.get('/colaboradores/me/solicitudes'), 'solicitudes'),
    nextPayment: () => payload(api.get('/colaboradores/me/proximo-pago'), 'proximoPago')
  },
  hr: {
    employees: () => payload(api.get('/colaboradores'), 'colaboradores')
  },
  admin: {
    departments: () => payload(api.get('/admin/departments'), 'departments'),
    requests: (params = {}) => api.get('/admin/requests', { params }).then(({ data }) => data),
    documents: (params = {}) => api.get('/admin/documents', { params }).then(({ data }) => data),
    synchronizations: (params = {}) => api.get('/admin/synchronizations', { params }).then(({ data }) => data)
  },
  reports: {
    latest: () => payload(api.get('/reports/latest'), 'report'),
    history: (params = {}) => payload(api.get('/reports/history', { params }), 'reports'),
    byDate: (date) => payload(api.get(`/reports/${encodeURIComponent(date)}`), 'report'),
    generate: () => api.post('/reports/generate', {}).then(({ data }) => data)
  },
  ingestion: {
    status: () => api.get('/admin/ingestion/status').then(({ data }) => data),
    candidates: () => payload(api.get('/admin/ingestion/candidates'), 'candidates'),
    sync: () => api.post('/admin/ingestion/sync', {}).then(({ data }) => data)
  },
  chat: {
    history: (params = {}) => payload(api.get('/chat/history', { params }), 'messages'),
    conversations: () => payload(api.get('/chat/conversations'), 'conversations'),
    conversation: (id) => payload(api.get(`/chat/conversations/${encodeURIComponent(id)}`), 'conversation'),
    send: ({ question, requestId, conversationId }) => api.post('/chat', {
      question,
      requestId,
      ...(conversationId ? { conversationId } : {})
    }).then(({ data }) => data)
  }
};
