import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Field } from '../components/ui/Field';
import { MaterialIcon } from '../components/ui/MaterialIcon';
import { SessionCheck } from '../routes/ProtectedRoute';

function destination(role) { return role === 'RRHH' ? '/rrhh' : '/mi-portal'; }

export function LoginPage() {
  const { login, user, status } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (status === 'checking') return <SessionCheck />;
  if (user) return <Navigate to={destination(user.rol)} replace />;

  async function submit(event) {
    event.preventDefault();
    setError('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Escribe un correo corporativo válido.');
      return;
    }
    setLoading(true);
    try {
      const currentUser = await login({ email: email.trim(), password });
      navigate(destination(currentUser.rol), { replace: true });
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'No pudimos iniciar sesión. Comprueba tu conexión e inténtalo de nuevo.');
    } finally { setLoading(false); }
  }

  return <main className="login-page">
    <section className="login-aside" aria-label="NexoTico, Personas y Cultura">
      <div className="login-brand"><span className="brand-mark">NT</span><div><strong>NexoTico</strong><span>Personas y Cultura</span></div></div>
      <div className="login-message"><p className="eyebrow">NEXOTICO SERVICIOS TECNOLÓGICOS</p><h1>Un espacio de trabajo que empieza con las personas.</h1><p>Tu información de Recursos Humanos, reunida en un solo lugar.</p></div>
      <div className="login-aside-footer"><span><MaterialIcon name="lock" />Acceso privado para colaboradores</span><span>Costa Rica</span></div>
    </section>
    <section className="login-panel">
      <div className="login-form-wrap">
        <div className="login-mobile-brand"><span className="brand-mark">NT</span><strong>NexoTico</strong></div>
        <div className="login-heading"><p className="eyebrow">PORTAL INTERNO</p><h2>Bienvenido de nuevo</h2><p>Ingresa con tus credenciales corporativas para continuar.</p></div>
        <form className="login-form" onSubmit={submit} noValidate>
          <Field id="login-email" label="Correo corporativo" type="email" autoComplete="username" inputMode="email" placeholder="nombre@nexotico.test" required value={email} onChange={(event) => setEmail(event.target.value)} />
          <div className="field password-field">
            <label htmlFor="login-password">Contraseña</label>
            <div className="password-input-wrap"><input id="login-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} aria-describedby={error ? 'login-error' : undefined} aria-invalid={Boolean(error)} />
              <button type="button" className="password-toggle" aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={showPassword} onClick={() => setShowPassword((value) => !value)}><MaterialIcon name={showPassword ? 'visibility_off' : 'visibility'} /></button>
            </div>
          </div>
          {error && <div className="form-alert" id="login-error" role="alert"><MaterialIcon name="error" /><span>{error}</span></div>}
          <Button className="login-submit" type="submit" disabled={loading || !email.trim() || !password} iconRight={loading ? 'progress_activity' : 'arrow_forward'}>{loading ? 'Ingresando…' : 'Iniciar sesión'}</Button>
        </form>
        <p className="login-support">¿Tienes problemas para ingresar? Comunícate con RRHH por los canales internos de la empresa.</p>
        <p className="login-privacy"><MaterialIcon name="verified_user" />Tus credenciales se procesan de forma segura.</p>
      </div>
      <footer className="login-copyright">© {new Date().getFullYear()} NexoTico Servicios Tecnológicos, S.R.L.</footer>
    </section>
  </main>;
}
