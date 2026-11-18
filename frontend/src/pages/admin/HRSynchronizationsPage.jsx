import { AdminStatusBadge, AdminTable } from '../../components/admin/AdminTable';
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

function loadSyncData() {
  return Promise.all([hrService.ingestion.status(), hrService.admin.synchronizations({ page: 1, pageSize: 100 })])
    .then(([status, history]) => ({ status, history }));
}

export function HRSynchronizationsPage() {
  const { data, loading, error, reload } = useApiResource(loadSyncData, []);
  const syncStatus = data?.status;
  const history = data?.history?.items || [];
  return <div className="admin-page">
    <PageHeader eyebrow="GOOGLE DRIVE" title="Sincronizaciones" description="Estado de la ingesta incremental y ejecuciones registradas por el agente documental." />
    {loading ? <LoadingBlock lines={4} /> : error ? <ResourceError error={error} onRetry={reload} /> : <>
      <section className="admin-sync-summary" aria-label="Estado de la sincronización documental">
        <Card className="admin-sync-card"><span className="admin-sync-label">Conexión de Drive</span><AdminStatusBadge value={syncStatus?.configured ? 'ACTIVO' : 'PENDIENTE'} label={syncStatus?.configured ? 'Configurada' : 'Sin configurar'} /></Card>
        <Card className="admin-sync-card"><span className="admin-sync-label">Piloto validado</span><AdminStatusBadge value={syncStatus?.pilotComplete ? 'COMPLETADO' : 'PENDIENTE'} label={syncStatus?.pilotComplete ? 'Completado' : 'Pendiente'} /></Card>
        <Card className="admin-sync-card"><span className="admin-sync-label">Sincronización inicial</span><AdminStatusBadge value={syncStatus?.initialSyncComplete ? 'COMPLETADA' : 'PENDIENTE'} label={syncStatus?.initialSyncComplete ? 'Completada' : 'Pendiente'} /></Card>
        <Card className="admin-sync-card"><span className="admin-sync-label">Última ejecución</span><strong>{dateTime(syncStatus?.lastSynchronization?.startedAt)}</strong></Card>
      </section>
      <Card className="admin-content-card admin-sync-status-card">
        <div className="admin-section-heading"><div><p className="eyebrow">DOCUMENTOS POR ESTADO</p><h2>Estado del índice</h2></div></div>
        {Object.entries(syncStatus?.documentsByStatus || {}).length ? <div className="admin-state-counts">{Object.entries(syncStatus.documentsByStatus).map(([state, count]) => <div key={state}><AdminStatusBadge value={state} /><strong>{formatNumber(count, 0)}</strong></div>)}</div> : <p className="admin-muted">No hay documentos registrados por estado.</p>}
      </Card>
      <Card className="admin-content-card">
        <div className="admin-section-heading"><div><p className="eyebrow">BITÁCORA</p><h2>Ejecuciones recientes</h2></div><span className="admin-muted">Últimas 100</span></div>
        <AdminTable rows={history} rowKey="id" caption="Historial de sincronizaciones de Google Drive" searchFields={['source', 'status']} searchPlaceholder="Buscar origen o estado" columns={[
          { key: 'startedAt', label: 'Inicio', render: (row) => dateTime(row.startedAt) },
          { key: 'finishedAt', label: 'Finalización', render: (row) => dateTime(row.finishedAt) },
          { key: 'source', label: 'Origen' },
          { key: 'documentsRead', label: 'Leídos', render: (row) => formatNumber(row.documentsRead, 0) },
          { key: 'documentsUpdated', label: 'Actualizados', render: (row) => formatNumber(row.documentsUpdated, 0) },
          { key: 'status', label: 'Estado', render: (row) => <AdminStatusBadge value={row.status} /> }
        ]} />
        {data?.history?.pagination && <p className="admin-api-limit-note">{formatNumber(data.history.pagination.total, 0)} ejecuciones registradas.</p>}
      </Card>
    </>}
  </div>;
}
