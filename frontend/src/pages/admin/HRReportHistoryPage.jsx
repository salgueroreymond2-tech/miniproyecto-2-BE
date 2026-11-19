import { useEffect, useState } from 'react';
import { AdminStatusBadge, AdminTable } from '../../components/admin/AdminTable';
import { GenerateReportButton } from '../../components/admin/GenerateReportButton';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/PageHeader';
import { LoadingBlock, ResourceError } from '../../components/ResourceState';
import { hrService } from '../../services/hrService';
import { formatDate, formatNumber, displayLabel } from '../../utils/format';

function dateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('es-CR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Costa_Rica' }).format(date);
}

export function HRReportHistoryPage() {
  const [history, setHistory] = useState([]);
  const [report, setReport] = useState(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState(false);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    hrService.reports.history({ limit: 365 }).then((records) => {
      if (!active) return;
      setHistory(records || []);
      setReport(records?.[0] || null);
      setSelectedDate(records?.[0]?.reportDate || '');
    }).catch((requestError) => { if (active) setError(requestError); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt]);

  async function selectReport(event) {
    const date = event.target.value;
    setSelectedDate(date);
    if (!date) { setReport(null); return; }
    const stored = history.find((item) => item.reportDate === date);
    if (stored) { setReport(stored); return; }
    setSelecting(true);
    setError(null);
    try { setReport(await hrService.reports.byDate(date)); }
    catch (requestError) { setError(requestError); }
    finally { setSelecting(false); }
  }

  function showGeneratedReport(generated) {
    setHistory((current) => [generated, ...current.filter((item) => item.reportDate !== generated.reportDate)]);
    setReport(generated);
    setSelectedDate(generated.reportDate);
    setError(null);
  }

  return <div className="admin-page">
    <PageHeader eyebrow="REPORTES DIARIOS" title="Historial de reportes" description="Consulta snapshots de indicadores guardados en MySQL. Las cifras no se recalculan al abrir un reporte."
      action={<div className="admin-report-actions">
        <label className="admin-report-selector" htmlFor="history-report-date"><span>Fecha del reporte</span><select id="history-report-date" value={selectedDate} onChange={selectReport} disabled={!history.length || loading}><option value="">Selecciona una fecha</option>{history.map((item) => <option key={item.reportDate} value={item.reportDate}>{formatDate(item.reportDate)}</option>)}</select></label>
        <GenerateReportButton onGenerated={showGeneratedReport} />
      </div>} />
    {loading || selecting ? <LoadingBlock lines={5} /> : error ? <ResourceError error={error} onRetry={() => setAttempt((value) => value + 1)} /> : !report ? <Card className="admin-content-card"><div className="admin-empty-message"><h2>No hay reportes guardados</h2><p>Cuando se genere el primer reporte diario, aparecerá en este historial.</p></div></Card> : <>
      <div className="admin-report-meta"><span>Fecha: {formatDate(report.reportDate)}</span><span>Guardado: {dateTime(report.storedAt)}</span><span>Resumen: <AdminStatusBadge value={report.executiveSummary.origin} label={report.executiveSummary.origin === 'DEEPSEEK' ? 'DeepSeek' : 'Respaldo SQL'} /></span></div>
      <Card className="admin-content-card admin-history-summary"><p className="eyebrow">RESUMEN EJECUTIVO</p><p>{report.executiveSummary.text}</p></Card>
      <section className="admin-history-kpis">
        <Card><span>Colaboradores activos</span><strong>{formatNumber(report.indicators.activeCollaborators, 0)}</strong></Card>
        <Card><span>Ausencias del día</span><strong>{formatNumber(report.indicators.absentCollaboratorsToday, 0)}</strong></Card>
        <Card><span>Solicitudes pendientes</span><strong>{formatNumber(report.requests.pendingCount, 0)}</strong></Card>
        <Card><span>Rotación acumulada</span><strong>{formatNumber(report.turnover.yearToDate.ratePercent)}%</strong></Card>
        <Card><span>Consultas al chatbot</span><strong>{formatNumber(report.chatbot.totalQueries, 0)}</strong></Card>
      </section>
      <Card className="admin-content-card">
        <div className="admin-section-heading"><div><p className="eyebrow">SEGUIMIENTO</p><h2>Solicitudes pendientes en la fecha</h2></div><span className="admin-count-pill">{report.requests.pendingRows.length}</span></div>
        <AdminTable rows={report.requests.pendingRows} rowKey="id" caption="Solicitudes pendientes guardadas dentro del reporte" searchFields={['name', 'code', 'department', 'type']} searchPlaceholder="Colaborador, código o departamento" rowClassName={(row) => row.daysWithoutResponse > 3 ? 'admin-row-overdue' : ''} columns={[
          { key: 'name', label: 'Colaborador', render: (row) => <div className="admin-person-cell"><strong>{row.name}</strong><small>{row.code}</small></div> },
          { key: 'department', label: 'Departamento' },
          { key: 'type', label: 'Tipo', render: (row) => displayLabel(row.type) },
          { key: 'startDate', label: 'Inicio', render: (row) => formatDate(row.startDate) },
          { key: 'requestedDays', label: 'Días solicitados', render: (row) => formatNumber(row.requestedDays, 2) },
          { key: 'daysWithoutResponse', label: 'Días sin respuesta', render: (row) => <strong className={row.daysWithoutResponse > 3 ? 'admin-overdue-label' : ''}>{formatNumber(row.daysWithoutResponse, 0)}</strong> }
        ]} />
      </Card>
      <Card className="admin-content-card"><div className="admin-section-heading"><div><p className="eyebrow">DISTRIBUCIÓN</p><h2>Solicitudes por estado</h2></div></div><div className="admin-state-counts">{report.requests.byStatus.length ? report.requests.byStatus.map((row) => <div key={row.status}><AdminStatusBadge value={row.status} label={displayLabel(row.status)} /><strong>{formatNumber(row.count, 0)}</strong></div>) : <p className="admin-muted">Sin solicitudes en el reporte.</p>}</div></Card>
    </>}
  </div>;
}
