import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getToken, SESSION_EXPIRED_EVENT, setToken } from '../services/api';
import { hrService } from '../services/hrService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState(() => getToken() ? 'checking' : 'ready');

  useEffect(() => {
    const expireSession = () => {
      setToken(null);
      setUser(null);
      setStatus('ready');
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, expireSession);

    if (getToken()) {
      hrService.auth.me()
        .then((currentUser) => { setUser(currentUser); setStatus('ready'); })
        .catch(() => expireSession());
    }
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, expireSession);
  }, []);

  const value = useMemo(() => ({
    user,
    status,
    async login(credentials) {
      const result = await hrService.auth.login(credentials);
      setToken(result.token);
      setUser(result.usuario);
      setStatus('ready');
      return result.usuario;
    },
    logout() { setToken(null); setUser(null); setStatus('ready'); }
  }), [user, status]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider.');
  return context;
}
