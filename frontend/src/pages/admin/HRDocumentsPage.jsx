import { useState } from 'react';
import { AdminStatusBadge, AdminTable } from '../../components/admin/AdminTable';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/PageHeader';
import { LoadingBlock, ResourceError } from '../../components/ResourceState';
import { useApiResource } from '../../hooks/useApiResource';
import { useToast } from '../../components/ui/ToastProvider';
import { MaterialIcon } from '../../components/ui/MaterialIcon';
import { hrService } from '../../services/hrService';
import { formatDate, formatNumber, displayLabel } from '../../utils/format';

function safeDriveUrl(value) {
  try {
    const url = new URL(value);
    return ['drive.google.com', 'docs.google.com'].includes(url.hostname) && url.protocol === 'https:' ? url.href : null;
  } catch { return null; }
}

export function HRDocumentsPage() {
  const { data, loading, error, reload } = useApiResource(() => hrService.admin.documents({ page: 1, pageSize: 200 }), []);
  const notify = useToast();
  const [confirmSync, setConfirmSync] = useState(false);
  const [syncing, setSyncing] = useState(false);

  async function synchronize() {
    setSyncing(true);
    setConfirmSync(false);
    try {
      const result = await hrService.ingestion.sync();
      await reload();
      notify(`Sincronización terminada. ${formatNumber(result.documentsUpdated, 0)} documentos actualizados.`, 'success');
    } catch (syncError) {
      notify(syncError?.response?.data?.error || 'No se pudo completar la sincronización de Google Drive.', 'error');
    } finally { setSyncing(false); }
  }

  return <div className="admin-page">
    <PageHeader eyebrow="BASE DE CONOCIMIENTO" title="Documentos indexados" description="Documentos validados y fragmentos disponibles para las consultas de políticas. Los originales permanecen en Google Drive."
      action={<Button icon="sync" disabled={syncing} onClick={() => setConfirmSync(true)}>{syncing ? 'Sincronizando…' : 'Sincronizar Drive'}</Button>} />
    <Card className="admin-content-card">
      {loading ? <LoadingBlock lines={6} /> : error ? <ResourceError error={error} onRetry={reload} /> : <AdminTable
        rows={data?.items || []}
        rowKey="driveFileId"
        caption="Documentos de políticas indexados"
        searchPlaceholder="Buscar por nombre o categoría"
        searchFields={['title', 'category', 'version']}
        filters={[{ key: 'category', label: 'Categoría', options: [...new Set((data?.items || []).map((item) => item.category).filter(Boolean))] }]}
        columns={[
          { key: 'title', label: 'Documento', render: (row) => <strong className="admin-document-title">{row.title}</strong> },
          { key: 'category', label: 'Categoría', render: (row) => displayLabel(row.category) },
          { key: 'version', label: 'Versión' },
          { key: 'indexedAt', label: 'Indexado', render: (row) => formatDate(row.indexedAt) },
          { key: 'fragmentCount', label: 'Fragmentos', render: (row) => formatNumber(row.fragmentCount, 0) },
          { key: 'status', label: 'Estado', render: (row) => <AdminStatusBadge value={row.status} /> },
          { key: 'sourceUrl', label: 'Origen', sortable: false, render: (row) => safeDriveUrl(row.sourceUrl) ? <a className="admin-external-link" href={safeDriveUrl(row.sourceUrl)} target="_blank" rel="noopener noreferrer">Abrir en Drive <MaterialIcon name="open_in_new" /></a> : <span>Enlace no disponible</span> }
        ]}
      />}
      {data?.pagination && <p className="admin-api-limit-note">{formatNumber(data.pagination.total, 0)} documentos validados registrados.</p>}
    </Card>
    {confirmSync && <Modal title="Sincronizar Google Drive" onClose={() => setConfirmSync(false)} actions={<><Button variant="secondary" onClick={() => setConfirmSync(false)}>Cancelar</Button><Button icon="sync" onClick={synchronize}>Iniciar sincronización</Button></>}>
      <p>Se consultarán los cambios de la carpeta autorizada y se actualizará el índice documental. Los archivos originales de Drive no se eliminan.</p>
    </Modal>}
  </div>;
}
