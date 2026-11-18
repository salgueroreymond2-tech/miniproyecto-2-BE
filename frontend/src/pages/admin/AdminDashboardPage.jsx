import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { MaterialIcon } from '../../components/ui/MaterialIcon';
import { EmptyState } from '../../components/ui/Feedback';
import { LoadingBlock, ResourceError } from '../../components/ResourceState';
import { PageHeader } from '../../components/PageHeader';
import { AdminStatusBadge } from '../../components/admin/AdminTable';
import { AbsenceDepartmentChart, AbsenceTrendChart, RequestStatusChart, TopicChart } from '../../components/admin/ReportCharts';
import { hrService } from '../../services/hrService';
import { formatDate, formatNumber } from '../../utils/format';

function formatDateTime(value) {
  if (!value) return 'Hora no disponible';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Hora no disponible' : new Intl.DateTimeFormat('es-CR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Costa_Rica' }).format(date);
}

function KpiCard({ icon, label, value, description, suffix }) {
  return <Card className="admin-kpi-card">
    <div className="admin-kpi-top"><span className="admin-kpi-icon"><MaterialIcon name={icon} /></span><span className="admin-kpi-label">{label}</span></div>
    <div className="admin-kpi-value">{value ?? '—'}{suffix && value !== null && value !== undefined && <small>{suffix}</small>}</div>
    <p className="admin-kpi-description">{description}</p>
  </Card>;
}

export function AdminDashboardPage() {
  const [report, setReport] = useState(null);
  const [history, setHistory] = useState([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState(false);
  const [error, setError] = useState(null);
  const [historyError, setHistoryError] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [latestResult, historyResult] = await Promise.allSettled([
      hrService.reports.latest(), hrService.reports.history({ limit: 60 })
    ]);
    if (latestResult.status === 'fulfilled') {
      setReport(latestResult.value);
      setSelectedDate(latestResult.value.reportDate || '');
    } else if (latestResult.reason?.response?.status === 404) {
      setReport(null);
      setSelectedDate('');
    } else {
      setReport(null);
      setError(latestResult.reason);
    }
    if (historyResult.status === 'fulfilled') { setHistory(historyResult.value || []); setHistoryError(null); }
    else setHistoryError(historyResult.reason);
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  async function chooseDate(event) {
    const date = event.target.value;
    setSelectedDate(date);
    if (!date) return;
    const savedReport = history.find((item) => item.reportDate === date);
    if (savedReport) { setReport(savedReport); return; }
    setSelecting(true);
    setError(null);
    try { setReport(await hrService.reports.byDate(date)); }
    catch (requestError) { setError(requestError); }
    finally { setSelecting(false); }
  }

  const reportOptions = useMemo(() => [...new Set([report?.reportDate, ...history.map((item) => item.reportDate)].filter(Boolean))].sort().reverse(), [report, history]);
  const kpis = report ? [
    { icon: 'groups', label: 'Colaboradores activos', value: formatNumber(report.indicators.activeCollaborators, 0), description: 'Registros con estado activo.' },
    { icon: 'event_busy', label: 'Ausencias del día', value: formatNumber(report.indicators.absentCollaboratorsToday, 0), description: 'Personas únicas en la fecha del reporte.' },
    { icon: 'pending_actions', label: 'Solicitudes pendientes', value: formatNumber(report.requests.pendingCount, 0), description: `${formatNumber(report.requests.olderThanThreeDaysCount, 0)} con más de tres días sin respuesta.` },
    { icon: 'medical_services', label: 'Incapacidades activas', value: formatNumber(report.incapacities.activeCollaborators, 0), description: `${formatNumber(report.incapacities.activeCount, 0)} registros vigentes.` },
    { icon: 'trending_up', label: 'Tasa de rotación', value: formatNumber(report.turnover.yearToDate.ratePercent), suffix: '%', description: 'Acumulada en el año según la fórmula documentada.' },
    { icon: 'beach_access', label: 'Vacaciones acumuladas', value: formatNumber(report.indicators.vacationBalancesOver20, 0), description: 'Personas activas con más de 20 días disponibles.' },
    { icon: 'forum', label: 'Consultas al chatbot', value: formatNumber(report.chatbot.totalQueries, 0), description: `Día anterior: ${formatDate(report.chatbot.previousDay)}.` },
    { icon: 'task_alt', label: 'Porcentaje de resolución', value: formatNumber(report.chatbot.percentResolvedWithoutEscalation), suffix: '%', description: 'Consultas respondidas sin escalamiento.' }
  ] : [];

  return <div className="admin-dashboard-page">
    <PageHeader eyebrow="RECURSOS HUMANOS · ADMINISTRACIÓN" title="Panel de RRHH" description="Indicadores y actividad construidos a partir del último reporte diario almacenado en MySQL."
      action={<label className="admin-report-selector" htmlFor="dashboard-report-date"><span>Reporte</span><select id="dashboard-report-date" value={selectedDate} onChange={chooseDate} disabled={loading || !reportOptions.length}>
        {reportOptions.length ? reportOptions.map((date) => <option key={date} value={date}>{formatDate(date)}</option>) : <option value="">Sin reportes</option>}
      </select></label>} />
    {loading || selecting ? <LoadingBlock lines={8} /> : error ? <ResourceError error={error} onRetry={reload} /> : !report ? <Card className="admin-empty-card"><EmptyState icon="analytics" title="Aún no hay reportes diarios" text="Cuando el agente analista guarde el primer reporte, sus indicadores aparecerán aquí." /></Card> : <>
      <div className="admin-report-meta"><span><MaterialIcon name="calendar_today" /> Generado {formatDateTime(report.storedAt)}</span><span><MaterialIcon name="database" /> Fuente: MySQL · {report.reportDate}</span></div>
      {historyError && <div className="admin-history-note" role="status">El historial de fechas no se pudo cargar. <button type="button" onClick={reload}>Reintentar</button></div>}
      <section className="admin-kpi-grid" aria-label="Indicadores principales de Recursos Humanos">
        {kpis.map((kpi) => <KpiCard key={kpi.label} {...kpi} />)}
      </section>

      <section className="admin-chart-grid" aria-label="Gráficos del reporte">
        <AbsenceTrendChart data={report.absences.trend30Days} />
        <AbsenceDepartmentChart data={report.absences.byTypeDepartment} />
        <RequestStatusChart data={report.requests.byStatus} />
        <TopicChart data={report.chatbot.topTopics} />
      </section>

      <section className="admin-detail-grid">
        <Card className="admin-executive-card">
          <div className="admin-section-heading"><div><p className="eyebrow">RESUMEN EJECUTIVO</p><h2>Lectura del día</h2></div><AdminStatusBadge value={report.executiveSummary.origin} label={report.executiveSummary.origin === 'DEEPSEEK' ? 'DeepSeek' : 'Respaldo SQL'} /></div>
          <p className="admin-summary-copy">{report.executiveSummary.text}</p>
          <p className="admin-source-note"><MaterialIcon name="database" /> Cifras del reporte guardado en `reportes_diarios` · {formatDateTime(report.storedAt)}</p>
        </Card>
        <Card className="admin-unanswered-card">
          <div className="admin-section-heading"><div><p className="eyebrow">BRECHAS DE CONOCIMIENTO</p><h2>Preguntas sin evidencia RAG</h2></div><span className="admin-count-pill">{report.chatbot.ragUnansweredQuestions.length}</span></div>
          {report.chatbot.ragUnansweredQuestions.length ? <ul className="admin-unanswered-list">{report.chatbot.ragUnansweredQuestions.map((item, index) => <li key={`${item.createdAt}-${index}`}><p>{item.question}</p><span>{formatDateTime(item.createdAt)}</span></li>)}</ul> : <EmptyState icon="task_alt" title="Sin preguntas pendientes" text="El reporte no registra consultas de políticas sin evidencia para el día anterior." />}
        </Card>
      </section>
    </>}
  </div>;
}
