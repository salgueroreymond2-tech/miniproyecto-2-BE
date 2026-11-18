import { useMemo } from 'react';
import { TopicChart } from '../../components/admin/ReportCharts';
import { AdminTable } from '../../components/admin/AdminTable';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/PageHeader';
import { LoadingBlock, ResourceError } from '../../components/ResourceState';
import { useApiResource } from '../../hooks/useApiResource';
import { hrService } from '../../services/hrService';
import { formatDate, formatNumber } from '../../utils/format';

function dateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('es-CR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Costa_Rica' }).format(date);
}

export function HRChatActivityPage() {
  const { data: reports, loading, error, reload } = useApiResource(() => hrService.reports.history({ limit: 365 }), []);
  const daily = useMemo(() => (reports || []).map((report) => ({
    ...report.chatbot,
    reportDate: report.reportDate,
    storedAt: report.storedAt,
    executiveSummaryOrigin: report.executiveSummary?.origin
  })), [reports]);
  const latest = daily[0];
  const recentQuestions = useMemo(() => daily.flatMap((day) => (day.ragUnansweredQuestions || []).map((item, index) => ({ ...item, id: `${day.reportDate}-${index}` }))), [daily]);
  return <div className="admin-page">
    <PageHeader eyebrow="ASISTENTE NEXOTICO" title="Actividad del chatbot" description="Métricas diarias y brechas de conocimiento tomadas de reportes históricos guardados en MySQL." />
    {loading ? <LoadingBlock lines={5} /> : error ? <ResourceError error={error} onRetry={reload} /> : !daily.length ? <Card className="admin-content-card"><div className="admin-empty-message"><h2>Sin reportes de actividad</h2><p>La actividad estará disponible cuando existan reportes diarios almacenados.</p></div></Card> : <>
      <section className="admin-kpi-grid admin-chat-kpis" aria-label="Actividad del chatbot en el reporte más reciente">
        <Card className="admin-kpi-card"><span className="admin-kpi-label">Consultas del período</span><strong className="admin-kpi-value">{formatNumber(latest.totalQueries, 0)}</strong><p className="admin-kpi-description">Día consultado: {formatDate(latest.previousDay)}.</p></Card>
        <Card className="admin-kpi-card"><span className="admin-kpi-label">Resueltas sin escalar</span><strong className="admin-kpi-value">{formatNumber(latest.percentResolvedWithoutEscalation)}%</strong><p className="admin-kpi-description">Proporción guardada por el agente analista.</p></Card>
        <Card className="admin-kpi-card"><span className="admin-kpi-label">Latencia promedio</span><strong className="admin-kpi-value">{latest.averageLatencyMs === null ? '—' : `${formatNumber(latest.averageLatencyMs)} ms`}</strong><p className="admin-kpi-description">Valor persistido en el reporte.</p></Card>
        <Card className="admin-kpi-card"><span className="admin-kpi-label">Preguntas sin evidencia</span><strong className="admin-kpi-value">{formatNumber(latest.ragUnansweredQuestions?.length || 0, 0)}</strong><p className="admin-kpi-description">Consultas de políticas no resueltas por falta de evidencia.</p></Card>
      </section>
      <section className="admin-chat-grid">
        <TopicChart data={latest.topTopics || []} />
        <Card className="admin-content-card admin-chat-meta"><p className="eyebrow">ORIGEN DEL REGISTRO</p><h2>Reporte guardado</h2><dl><div><dt>Fecha de actividad</dt><dd>{formatDate(latest.previousDay)}</dd></div><div><dt>Reporte asociado</dt><dd>{formatDate(latest.reportDate)}</dd></div><div><dt>Almacenado</dt><dd>{dateTime(latest.storedAt)}</dd></div><div><dt>Resumen</dt><dd>{latest.executiveSummaryOrigin === 'DEEPSEEK' ? 'DeepSeek' : 'Respaldo SQL'}</dd></div></dl></Card>
      </section>
      <Card className="admin-content-card">
        <div className="admin-section-heading"><div><p className="eyebrow">BRECHAS RAG</p><h2>Preguntas sin evidencia</h2></div><span className="admin-count-pill">{recentQuestions.length}</span></div>
        <AdminTable rows={recentQuestions} rowKey="id" caption="Preguntas sin evidencia de los reportes históricos" searchFields={['question', 'intent']} searchPlaceholder="Buscar pregunta o intención" columns={[
          { key: 'question', label: 'Pregunta' },
          { key: 'intent', label: 'Intención' },
          { key: 'createdAt', label: 'Registrada', render: (row) => dateTime(row.createdAt) }
        ]} />
      </Card>
      <Card className="admin-content-card">
        <div className="admin-section-heading"><div><p className="eyebrow">HISTORIAL AGREGADO</p><h2>Actividad por día</h2></div></div>
        <AdminTable rows={daily} rowKey="reportDate" caption="Estadísticas diarias del chatbot" searchFields={['reportDate', 'previousDay']} columns={[
          { key: 'previousDay', label: 'Fecha', render: (row) => formatDate(row.previousDay) },
          { key: 'totalQueries', label: 'Consultas', render: (row) => formatNumber(row.totalQueries, 0) },
          { key: 'percentResolvedWithoutEscalation', label: 'Resueltas', render: (row) => `${formatNumber(row.percentResolvedWithoutEscalation)}%` },
          { key: 'averageLatencyMs', label: 'Latencia promedio', render: (row) => row.averageLatencyMs === null ? '—' : `${formatNumber(row.averageLatencyMs)} ms` },
          { key: 'ragUnansweredQuestions', label: 'Sin evidencia', render: (row) => formatNumber(row.ragUnansweredQuestions?.length || 0, 0) }
        ]} />
      </Card>
    </>}
  </div>;
}
