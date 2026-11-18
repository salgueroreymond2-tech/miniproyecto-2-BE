import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AppFooter } from '../components/AppFooter';
import { Button } from '../components/ui/Button';
import { MaterialIcon } from '../components/ui/MaterialIcon';
import { Modal } from '../components/ui/Modal';

const employeeLinks = [
  { to: '/mi-portal', label: 'Inicio', icon: 'space_dashboard', end: true },
  { to: '/mi-portal/perfil', label: 'Mi perfil', icon: 'badge' },
  { to: '/mi-portal/vacaciones', label: 'Mis vacaciones', icon: 'beach_access' },
  { to: '/mi-portal/solicitudes', label: 'Mis solicitudes', icon: 'assignment' },
  { to: '/mi-portal/pagos', label: 'Próximos pagos', icon: 'payments' },
  { to: '/mi-portal/asistente', label: 'Asistente inteligente', icon: 'forum' }
];
const hrLinks = [
  { to: '/rrhh', label: 'Dashboard general', icon: 'space_dashboard', end: true },
  { to: '/rrhh/colaboradores', label: 'Colaboradores', icon: 'groups' },
  { to: '/rrhh/departamentos', label: 'Departamentos', icon: 'domain' },
  { to: '/rrhh/solicitudes', label: 'Solicitudes', icon: 'assignment' },
  { to: '/rrhh/documentos', label: 'Documentos indexados', icon: 'library_books' },
  { to: '/rrhh/sincronizaciones', label: 'Sincronizaciones', icon: 'sync' },
  { to: '/rrhh/chatbot', label: 'Actividad del chatbot', icon: 'forum' },
  { to: '/rrhh/reportes', label: 'Historial de reportes', icon: 'analytics' }
];
const pageTitles = {
  '/mi-portal': 'Inicio', '/mi-portal/perfil': 'Mi perfil', '/mi-portal/vacaciones': 'Mis vacaciones',
  '/mi-portal/solicitudes': 'Mis solicitudes', '/mi-portal/pagos': 'Próximos pagos',
  '/mi-portal/asistente': 'Asistente inteligente', '/rrhh': 'Dashboard general',
  '/rrhh/colaboradores': 'Colaboradores', '/rrhh/departamentos': 'Departamentos',
  '/rrhh/solicitudes': 'Solicitudes', '/rrhh/documentos': 'Documentos indexados',
  '/rrhh/sincronizaciones': 'Sincronizaciones', '/rrhh/chatbot': 'Actividad del chatbot',
  '/rrhh/reportes': 'Historial de reportes'
};

export function PortalLayout() {
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(() => window.innerWidth <= 1160);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const isHr = user?.rol === 'RRHH';
  const links = isHr ? hrLinks : employeeLinks;
  const title = pageTitles[location.pathname] || (isHr ? 'Dashboard general' : 'Mi portal');

  useEffect(() => {
    const syncSidebar = () => setCollapsed(window.innerWidth <= 1160);
    window.addEventListener('resize', syncSidebar);
    return () => window.removeEventListener('resize', syncSidebar);
  }, []);

  function confirmSignOut() {
    setConfirmLogout(false);
    logout();
    navigate('/login', { replace: true });
  }

  return <div className={`portal-shell ${collapsed ? 'sidebar-collapsed' : ''} ${mobileOpen ? 'mobile-menu-open' : ''}`}>
    <aside className="sidebar" id="main-sidebar" aria-label="Navegación principal">
      <div className="brand-lockup">
        <span className="brand-mark" aria-hidden="true">NT</span>
        <span className="brand-text"><strong>NexoTico</strong><small>Personas y Cultura</small></span>
        <button className="sidebar-close icon-button" type="button" aria-label="Cerrar menú" onClick={() => setMobileOpen(false)}><MaterialIcon name="close" /></button>
      </div>
      <div className="sidebar-company"><span className="sidebar-company-label">NEXOTICO SERVICIOS TECNOLÓGICOS</span><span>{isHr ? 'Administración' : 'Portal del colaborador'}</span></div>
      <nav className="sidebar-nav">
        <p className="nav-section-label">MENÚ PRINCIPAL</p>
        {links.map((link) => <NavLink key={link.to} to={link.to} end={link.end} onClick={() => setMobileOpen(false)} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} title={collapsed ? link.label : undefined}>
          <MaterialIcon name={link.icon} /><span className="nav-label">{link.label}</span>
        </NavLink>)}
      </nav>
      {!isHr && <div className="sidebar-assistance"><span className="assistance-symbol"><MaterialIcon name="support_agent" /></span><strong>¿Necesitas ayuda?</strong><p>Consulta políticas y tus datos en el asistente.</p><NavLink to="/mi-portal/asistente" onClick={() => setMobileOpen(false)}>Abrir asistente <MaterialIcon name="arrow_forward" /></NavLink></div>}
      <div className="sidebar-bottom"><span className="sidebar-secure"><MaterialIcon name="verified_user" />Acceso seguro</span><button type="button" className="sidebar-collapse icon-button" aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'} aria-expanded={!collapsed} onClick={() => setCollapsed((value) => !value)}><MaterialIcon name={collapsed ? 'keyboard_double_arrow_right' : 'keyboard_double_arrow_left'} /></button></div>
    </aside>
    {mobileOpen && <button className="mobile-scrim" type="button" aria-label="Cerrar menú" onClick={() => setMobileOpen(false)} />}

    <div className="portal-main">
      <header className="topbar">
        <div className="topbar-left">
          <Button className="mobile-menu-button" variant="quiet" size="sm" icon="menu" aria-label="Abrir menú" aria-controls="main-sidebar" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)} />
          <div className="breadcrumb"><span>Portal interno</span><MaterialIcon name="chevron_right" /><strong>{title}</strong></div>
        </div>
        <div className="topbar-right">
          <div className="session-chip"><span className="session-dot" /><span>Sesión activa</span></div>
          <div className="user-chip"><span className="user-avatar">{user?.email?.slice(0, 1).toUpperCase() || 'N'}</span><span className="user-details"><strong>{user?.email}</strong><small>{isHr ? 'Recursos Humanos' : 'Colaborador'}</small></span></div>
          <Button variant="quiet" size="sm" icon="logout" className="logout-button" onClick={() => setConfirmLogout(true)}>Salir</Button>
        </div>
      </header>
      <main className="page-content" id="main-content" tabIndex="-1"><Outlet /></main>
      <AppFooter />
    </div>

    {confirmLogout && <Modal title="Cerrar sesión" onClose={() => setConfirmLogout(false)} actions={<><Button variant="secondary" onClick={() => setConfirmLogout(false)}>Continuar aquí</Button><Button variant="danger" onClick={confirmSignOut}>Cerrar sesión</Button></>}>
      <p>¿Quieres terminar tu sesión en el portal de NexoTico?</p>
    </Modal>}
  </div>;
}
