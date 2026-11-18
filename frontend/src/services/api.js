import axios from 'axios';

const TOKEN_KEY = 'nexotico.session.token';
export const SESSION_EXPIRED_EVENT = 'nexotico:session-expired';

export const api = axios.create({ baseURL: '/api', timeout: 60000 });

export function getToken() {
  try { return window.sessionStorage.getItem(TOKEN_KEY); }
  catch { return null; }
}

export function setToken(token) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
    try { window.sessionStorage.setItem(TOKEN_KEY, token); } catch { /* El token permanece en memoria si el almacenamiento está bloqueado. */ }
  } else {
    delete api.defaults.headers.common.Authorization;
    try { window.sessionStorage.removeItem(TOKEN_KEY); } catch { /* No hay almacenamiento que limpiar. */ }
  }
}

const initialToken = getToken();
if (initialToken) api.defaults.headers.common.Authorization = `Bearer ${initialToken}`;

api.interceptors.response.use((response) => response, (error) => {
  if (error.response?.status === 401 && getToken()) {
    setToken(null);
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  }
  return Promise.reject(error);
});
