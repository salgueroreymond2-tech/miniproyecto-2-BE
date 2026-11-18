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
