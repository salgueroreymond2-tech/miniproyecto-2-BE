import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { PortalLayout } from './layouts/PortalLayout';
import { AssistantPage } from './pages/AssistantPage';
import { DashboardPage } from './pages/DashboardPage';
import { HRDirectoryPage } from './pages/HRDirectoryPage';
import { LoginPage } from './pages/LoginPage';
import { PaymentsPage } from './pages/PaymentsPage';
import { ProfilePage } from './pages/ProfilePage';
import { RequestsPage } from './pages/RequestsPage';
import { VacationsPage } from './pages/VacationsPage';
import { ProtectedRoute } from './routes/ProtectedRoute';

function HomeRedirect() {
  const { user } = useAuth();
  return <Navigate to={user?.rol === 'RRHH' ? '/rrhh' : '/mi-portal'} replace />;
}

export function App() {
  return <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route element={<ProtectedRoute roles={['COLABORADOR']} />}>
      <Route path="/mi-portal" element={<PortalLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="perfil" element={<ProfilePage />} />
        <Route path="vacaciones" element={<VacationsPage />} />
        <Route path="solicitudes" element={<RequestsPage />} />
        <Route path="pagos" element={<PaymentsPage />} />
        <Route path="asistente" element={<AssistantPage />} />
      </Route>
    </Route>
    <Route element={<ProtectedRoute roles={['RRHH']} />}>
      <Route path="/rrhh" element={<PortalLayout />}><Route index element={<HRDirectoryPage />} /></Route>
    </Route>
    <Route path="/" element={<HomeRedirect />} />
    <Route path="*" element={<HomeRedirect />} />
  </Routes>;
}
