import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { MaterialIcon } from '../components/ui/MaterialIcon';

export function SessionCheck() {
  return <main className="session-check" role="status"><MaterialIcon name="progress_activity" /><span>Verificando sesión</span></main>;
}

export function ProtectedRoute({ roles }) {
  const { user, status } = useAuth();
  if (status === 'checking') return <SessionCheck />;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.rol)) return <Navigate to={user.rol === 'RRHH' ? '/rrhh' : '/mi-portal'} replace />;
  return <Outlet />;
}
