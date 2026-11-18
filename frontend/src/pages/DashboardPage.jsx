import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { hrService } from '../services/hrService';
import { formatDate, formatNumber, displayLabel } from '../utils/format';
import { PageHeader } from '../components/PageHeader';
import { Card } from '../components/ui/Card';
import { MaterialIcon } from '../components/ui/MaterialIcon';
import { Badge } from '../components/ui/Badge';
import { DataTable } from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/Feedback';
import { LoadingBlock, ResourceError } from '../components/ResourceState';

function SummaryCard({ icon, label, children, loading, error, onRetry, href, footnote }) {
  const body = <Card className="summary-card"><div className="summary-top"><span className="summary-icon"><MaterialIcon name={icon} /></span><span className="summary-label">{label}</span></div>
    {loading ? <LoadingBlock lines={1} /> : error ? <ResourceError error={error} onRetry={onRetry} /> : <><div className="summary-value">{children}</div>{footnote && <p className="summary-footnote">{footnote}</p>}</>}
    {href && <Link className="card-link" to={href}>Ver detalle <MaterialIcon name="arrow_forward" /></Link>}
  </Card>;
  return body;
}

function useOverview() {
  const [state, setState] = useState({ loading: true, profile: null, vacations: null, requests: null, payday: null, errors: {} });
  const reload = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, errors: {} }));
    const results = await Promise.allSettled([
      hrService.employee.profile(), hrService.employee.vacations(), hrService.employee.requests(), hrService.employee.nextPayment()
    ]);
    const [profile, vacations, requests, payday] = results.map((result) => result.status === 'fulfilled' ? result.value : null);
    const keys = ['profile', 'vacations', 'requests', 'payday'];
    const errors = Object.fromEntries(results.flatMap((result, index) => result.status === 'rejected' ? [[keys[index], result.reason]] : []));
    setState({ loading: false, profile, vacations, requests, payday, errors });
  }, []);
  useEffect(() => { reload(); }, [reload]);
  return { ...state, reload };
}

export function DashboardPage() {
  const data = useOverview();
  const latestBalance = data.vacations?.[0];
  const pendingCount = data.requests?.filter((request) => request.estado === 'PENDIENTE').length;
  const firstName = data.profile?.nombres?.trim().split(/\s+/)[0];
  const recentRequests = data.requests?.slice(0, 4) || [];

  return <>
    <PageHeader eyebrow="TU ESPACIO EN NEXOTICO" title={firstName ? `Hola, ${firstName}` : 'Bienvenido a tu portal'} description="Consulta tu información y mantente al día con tus gestiones de Recursos Humanos." />
    <section className="summary-grid" aria-label="Resumen de mi información">
      <SummaryCard icon="beach_access" label="Días disponibles" loading={data.loading} error={data.errors.vacations} onRetry={data.reload} href="/mi-portal/vacaciones" footnote={latestBalance ? `Período ${latestBalance.periodo_anual}` : 'Saldo de vacaciones'}>
        {latestBalance ? <>{formatNumber(latestBalance.dias_disponibles)} <small>días</small></> : '—'}
      </SummaryCard>
      <SummaryCard icon="pending_actions" label="Solicitudes pendientes" loading={data.loading} error={data.errors.requests} onRetry={data.reload} href="/mi-portal/solicitudes" footnote="Según tus registros actuales">
        {pendingCount === undefined ? '—' : pendingCount}
      </SummaryCard>
      <SummaryCard icon="calendar_month" label="Próximo pago" loading={data.loading} error={data.errors.payday} onRetry={data.reload} href="/mi-portal/pagos" footnote={data.payday?.tipo ? displayLabel(data.payday.tipo) : 'Calendario de pagos'}>
        {data.payday ? formatDate(data.payday.fecha_pago, { month: 'short' }) : '—'}
      </SummaryCard>
      <SummaryCard icon="work" label="Mi departamento" loading={data.loading} error={data.errors.profile} onRetry={data.reload} href="/mi-portal/perfil" footnote={data.profile?.puesto || 'Información del perfil'}>
        {data.profile?.departamento || '—'}
      </SummaryCard>
    </section>

    <div className="dashboard-columns">
      <Card className="dashboard-card">
        <div className="section-heading"><div><p className="eyebrow">ACTIVIDAD</p><h2>Mis solicitudes recientes</h2></div><Link className="text-link" to="/mi-portal/solicitudes">Ver todas <MaterialIcon name="arrow_forward" /></Link></div>
        {data.loading ? <LoadingBlock lines={4} /> : data.errors.requests ? <ResourceError error={data.errors.requests} onRetry={data.reload} /> : recentRequests.length ? <DataTable caption="Solicitudes recientes" rowKey="id" rows={recentRequests} columns={[
          { key: 'tipo', label: 'Tipo', render: (row) => displayLabel(row.tipo) },
          { key: 'fecha_inicio', label: 'Fecha', render: (row) => formatDate(row.fecha_inicio) },
          { key: 'estado', label: 'Estado', render: (row) => <Badge value={row.estado} /> }
        ]} /> : <EmptyState icon="assignment" title="Aún no tienes solicitudes" text="Cuando haya solicitudes asociadas a tu perfil, aparecerán aquí." />}
      </Card>
      <Card className="assistant-callout">
        <span className="callout-icon"><MaterialIcon name="forum" /></span>
        <p className="eyebrow">ASISTENTE DE RRHH</p><h2>¿Tienes una consulta?</h2>
        <p>Pregunta sobre políticas o consulta tus propios registros de Recursos Humanos.</p>
        <Link className="button button-primary button-md" to="/mi-portal/asistente"><span>Abrir asistente</span><MaterialIcon name="arrow_forward" /></Link>
        <span className="callout-note"><MaterialIcon name="lock" />Tus consultas son privadas</span>
      </Card>
    </div>
    <Card className="quick-access-card">
      <div className="section-heading"><div><p className="eyebrow">ACCESO RÁPIDO</p><h2>Lo que necesitas, a mano</h2></div></div>
      <div className="quick-links">
        {[
          { to: '/mi-portal/perfil', icon: 'badge', label: 'Mi perfil', description: 'Revisa tus datos laborales' },
          { to: '/mi-portal/vacaciones', icon: 'beach_access', label: 'Vacaciones', description: 'Consulta tus saldos' },
          { to: '/mi-portal/solicitudes', icon: 'assignment', label: 'Solicitudes', description: 'Revisa estados y fechas' },
          { to: '/mi-portal/pagos', icon: 'payments', label: 'Pagos', description: 'Consulta el calendario' }
        ].map((item) => <Link className="quick-link" to={item.to} key={item.to}><span><MaterialIcon name={item.icon} /></span><div><strong>{item.label}</strong><small>{item.description}</small></div><MaterialIcon name="chevron_right" className="quick-arrow" /></Link>)}
      </div>
    </Card>
  </>;
}
