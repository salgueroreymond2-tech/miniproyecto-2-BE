import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { PortalLayout } from './layouts/PortalLayout';
import { AssistantPage } from './pages/AssistantPage';
import { DashboardPage } from './pages/DashboardPage';
import { HRDirectoryPage } from './pages/HRDirectoryPage';
import { MaterialIcon } from './components/ui/MaterialIcon';
import { LoginPage } from './pages/LoginPage';
import { PaymentsPage } from './pages/PaymentsPage';
import { ProfilePage } from './pages/ProfilePage';
import { RequestsPage } from './pages/RequestsPage';
import { VacationsPage } from './pages/VacationsPage';
import { ProtectedRoute } from './routes/ProtectedRoute';

const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage').then((module) => ({ default: module.AdminDashboardPage })));
const HRDepartmentsPage = lazy(() => import('./pages/admin/HRDepartmentsPage').then((module) => ({ default: module.HRDepartmentsPage })));
const HRRequestsPage = lazy(() => import('./pages/admin/HRRequestsPage').then((module) => ({ default: module.HRRequestsPage })));
const HRDocumentsPage = lazy(() => import('./pages/admin/HRDocumentsPage').then((module) => ({ default: module.HRDocumentsPage })));
const HRSynchronizationsPage = lazy(() => import('./pages/admin/HRSynchronizationsPage').then((module) => ({ default: module.HRSynchronizationsPage })));
const HRChatActivityPage = lazy(() => import('./pages/admin/HRChatActivityPage').then((module) => ({ default: module.HRChatActivityPage })));
const HRReportHistoryPage = lazy(() => import('./pages/admin/HRReportHistoryPage').then((module) => ({ default: module.HRReportHistoryPage })));

function AdminView({ component: Component }) {
  return <Suspense fallback={<main className="admin-route-loading" role="status"><MaterialIcon name="progress_activity" /><span>Cargando vista</span></main>}><Component /></Suspense>;
}

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
      <Route path="/rrhh" element={<PortalLayout />}>
        <Route index element={<AdminView component={AdminDashboardPage} />} />
        <Route path="colaboradores" element={<HRDirectoryPage />} />
        <Route path="departamentos" element={<AdminView component={HRDepartmentsPage} />} />
        <Route path="solicitudes" element={<AdminView component={HRRequestsPage} />} />
        <Route path="documentos" element={<AdminView component={HRDocumentsPage} />} />
        <Route path="sincronizaciones" element={<AdminView component={HRSynchronizationsPage} />} />
        <Route path="chatbot" element={<AdminView component={HRChatActivityPage} />} />
        <Route path="reportes" element={<AdminView component={HRReportHistoryPage} />} />
      </Route>
    </Route>
    <Route path="/" element={<HomeRedirect />} />
    <Route path="*" element={<HomeRedirect />} />
  </Routes>;
}
