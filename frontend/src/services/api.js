import axios from 'axios';

export const api = axios.create({ baseURL: '/api', timeout: 10000 });

export function setToken(token) {
  if (token) api.defaults.headers.common.Authorization = `Bearer ${token}`;
  else delete api.defaults.headers.common.Authorization;
}
