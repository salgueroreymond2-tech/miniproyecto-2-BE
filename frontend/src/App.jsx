import { useState } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { api, setToken } from './services/api';

export function Login({ onLogin }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email, password });
      setToken(data.token);
      onLogin(data.usuario);
      navigate(data.usuario.rol === 'RRHH' ? '/rrhh' : '/mi-portal', { replace: true, state: { usuario: data.usuario } });
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'No se pudo conectar con el servidor.');
    } finally {
      setLoading(false);
    }
  }

  return <main className="shell"><div className="card">
    <p className="eyebrow">NEXOTICO · PERSONAS Y CULTURA</p>
    <h1>Bienvenido de nuevo</h1>
    <p className="subtitle">Ingresa para acceder a tu portal de colaboradores.</p>
    <form onSubmit={handleSubmit}>
      <label htmlFor="email">Correo corporativo</label>
      <input id="email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nombre@nexotico.test" />
      <label htmlFor="password">Contraseña</label>
      <input id="password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
      {error && <p role="alert" className="error">{error}</p>}
      <button disabled={loading} type="submit">{loading ? 'Ingresando…' : 'Ingresar'}</button>
    </form>
  </div></main>;
}

function Landing({ title, onLogout }) {
  return <main className="shell"><div className="card"><p className="eyebrow">NEXOTICO</p><h1>{title}</h1><p className="subtitle">Has iniciado sesión correctamente.</p><button onClick={onLogout}>Cerrar sesión</button></div></main>;
}

export function App() {
  const [usuario, setUsuario] = useState(null);
  function logout() { setToken(null); setUsuario(null); }
  return <Routes>
    <Route path="/login" element={<Login onLogin={setUsuario} />} />
    <Route path="/rrhh" element={usuario?.rol === 'RRHH' ? <Landing title="Portal de RRHH" onLogout={logout} /> : <Navigate to="/login" replace />} />
    <Route path="/mi-portal" element={usuario ? <Landing title="Mi portal" onLogout={logout} /> : <Navigate to="/login" replace />} />
    <Route path="*" element={<Navigate to="/login" replace />} />
  </Routes>;
}
