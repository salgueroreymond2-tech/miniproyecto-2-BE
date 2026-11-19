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

function candidateUrl(fileId) {
  return safeDriveUrl(`https://drive.google.com/open?id=${encodeURIComponent(fileId)}`);
}

export function HRDocumentsPage() {
  const { data, loading, error, reload } = useApiResource(() => hrService.admin.documents({ page: 1, pageSize: 200 }), []);
  const notify = useToast();
  const [confirmSync, setConfirmSync] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewStatus, setReviewStatus] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState('');
  const [candidateLoading, setCandidateLoading] = useState(false);
  const [candidateBusy, setCandidateBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [category, setCategory] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [legalSourcesText, setLegalSourcesText] = useState('');
  const [reviewedNoPersonalData, setReviewedNoPersonalData] = useState(false);
  const [reviewedNormativeContent, setReviewedNormativeContent] = useState(false);

  const selectedCandidate = candidates.find((item) => item.driveFileId === selectedCandidateId);
  const legalSources = [...new Set(legalSourcesText.split(/[\n,]+/u).map((source) => source.trim()).filter(Boolean))];
  const canApprove = Boolean(
    selectedCandidate?.status === 'PENDIENTE_VALIDACION_NORMATIVA'
    && category
    && legalSources.length > 0
    && reviewedNoPersonalData
    && reviewedNormativeContent
  );

  async function openCandidateReview() {
    setReviewOpen(true);
    setCandidateLoading(true);
    try {
      const [status, driveCandidates] = await Promise.all([
        hrService.ingestion.status(),
        hrService.ingestion.candidates()
      ]);
      setReviewStatus(status);
      setCandidates(driveCandidates);
      const preferred = driveCandidates.find((item) => item.status === 'APROBADO_PARA_INGESTA')
        || driveCandidates.find((item) => item.status === 'PENDIENTE_VALIDACION_NORMATIVA');
      setSelectedCandidateId((current) => driveCandidates.some((item) => item.driveFileId === current)
        ? current
        : preferred?.driveFileId || '');
    } catch (reviewError) {
      notify(reviewError?.response?.data?.error || 'No se pudieron consultar los documentos de Drive.', 'error');
    } finally { setCandidateLoading(false); }
  }

  async function performSync() {
    setSyncing(true);
    try {
      const result = await hrService.ingestion.sync();
      await reload();
      notify(`Sincronización terminada. ${formatNumber(result.documentsUpdated, 0)} documentos actualizados.`, 'success');
      return true;
    } catch (syncError) {
      notify(syncError?.response?.data?.error || 'No se pudo completar la sincronización de Google Drive.', 'error');
      return false;
    } finally { setSyncing(false); }
  }

  async function synchronize() {
    setConfirmSync(false);
    try {
      const status = await hrService.ingestion.status();
      setReviewStatus(status);
      if (!status.pilotComplete) {
        await openCandidateReview();
        return;
      }
      await performSync();
    } catch (syncError) {
      notify(syncError?.response?.data?.error || 'No se pudo consultar el estado de Google Drive.', 'error');
    }
  }

  function selectCandidate(candidate) {
    setSelectedCandidateId(candidate.driveFileId);
    setCategory('');
    setEffectiveDate('');
    setLegalSourcesText('');
    setReviewedNoPersonalData(false);
    setReviewedNormativeContent(false);
  }

  async function approveCandidate() {
    if (!selectedCandidate || !canApprove) return;
    setCandidateBusy(true);
    try {
      await hrService.ingestion.approve({
        driveFileId: selectedCandidate.driveFileId,
        contentHash: selectedCandidate.contentHash,
        category,
        effectiveDate: effectiveDate || null,
        legalSources,
        reviewedNoPersonalData: true,
        reviewedNormativeContent: true
      });
      setCandidates((current) => current.map((item) => item.driveFileId === selectedCandidate.driveFileId
        ? { ...item, status: 'APROBADO_PARA_INGESTA' }
        : item));
      setCategory('');
      setEffectiveDate('');
      setLegalSourcesText('');
      setReviewedNoPersonalData(false);
      setReviewedNormativeContent(false);
      notify('Revisión registrada. Puedes ejecutar el piloto de este documento.', 'success');
    } catch (approvalError) {
      notify(approvalError?.response?.data?.error || 'No se pudo registrar la revisión del documento.', 'error');
    } finally { setCandidateBusy(false); }
  }

  async function runPilot() {
    if (!selectedCandidate || selectedCandidate.status !== 'APROBADO_PARA_INGESTA') return;
    setCandidateBusy(true);
    try {
      await hrService.ingestion.pilot(selectedCandidate.driveFileId);
      const status = await hrService.ingestion.status();
      setReviewStatus(status);
      if (!status.pilotComplete) {
        notify('El piloto terminó, pero todavía no confirmó un documento indexado.', 'error');
        return;
      }
      setReviewOpen(false);
      notify('Piloto validado. Iniciando la sincronización de la carpeta.', 'success');
      await performSync();
    } catch (pilotError) {
      notify(pilotError?.response?.data?.error || 'No se pudo completar el piloto de ingesta.', 'error');
    } finally { setCandidateBusy(false); }
  }

  return <div className="admin-page">
    <PageHeader eyebrow="BASE DE CONOCIMIENTO" title="Documentos indexados" description="Documentos validados y fragmentos disponibles para las consultas de políticas. Los originales permanecen en Google Drive."
      action={<div className="admin-doc-actions"><Button variant="secondary" icon="fact_check" disabled={candidateLoading || syncing} onClick={openCandidateReview}>Revisar candidatos</Button><Button icon="sync" disabled={syncing} onClick={() => setConfirmSync(true)}>{syncing ? 'Sincronizando…' : 'Sincronizar Drive'}</Button></div>} />
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
    {reviewOpen && <Modal title="Revisión de candidatos de Drive" onClose={() => setReviewOpen(false)}>
      {candidateLoading ? <div className="admin-candidate-loading"><p>Consultando Drive y verificando texto y datos personales de los documentos. Esto puede tardar unos segundos.</p><LoadingBlock lines={5} /></div> : <div className="admin-ingestion-review">
        {!reviewStatus?.configured && <p className="admin-review-notice" role="alert">Google Drive no está configurado en el servidor.</p>}
        {reviewStatus?.configured && <p className="admin-auto-sync-note" role="status">La carpeta ya es legible por el servicio. El permiso Editor de Drive no sustituye la revisión interna de RRHH. Tras completar el primer piloto, el servidor intentará sincronizar automáticamente cada día a las 6:00 a. m. (hora de Costa Rica); debe permanecer activo.</p>}
        {reviewStatus?.configured && !reviewStatus.pilotComplete && <p className="admin-review-notice" role="status">Antes de la sincronización completa, RRHH debe revisar un documento, registrar su aprobación y comprobar el piloto. Los demás documentos sin aprobación permanecerán pendientes.</p>}
        {candidates.length ? <div className="admin-candidate-list" aria-label="Candidatos de Drive">
          {candidates.map((candidate) => <article className={`admin-candidate ${candidate.driveFileId === selectedCandidateId ? 'selected' : ''}`} key={candidate.driveFileId}>
            <div className="admin-candidate-heading"><strong>{candidate.title || 'Documento sin título'}</strong><AdminStatusBadge value={candidate.status} /></div>
            <span className="admin-candidate-type">{candidate.mimeType || 'Formato no compatible'}</span>
            {candidateUrl(candidate.driveFileId) && <a className="admin-external-link" href={candidateUrl(candidate.driveFileId)} target="_blank" rel="noopener noreferrer">Revisar original en Drive <MaterialIcon name="open_in_new" /></a>}
            <Button size="sm" variant="quiet" aria-pressed={candidate.driveFileId === selectedCandidateId} onClick={() => selectCandidate(candidate)}>Seleccionar documento</Button>
          </article>)}
        </div> : <p>No se encontraron documentos candidatos en la carpeta.</p>}
        {selectedCandidate?.status === 'PENDIENTE_VALIDACION_NORMATIVA' && <form className="admin-review-form" onSubmit={(event) => { event.preventDefault(); approveCandidate(); }}>
          <h3>Registrar revisión de RRHH</h3>
          <div className="field"><label htmlFor="review-category">Categoría documental</label><select id="review-category" value={category} onChange={(event) => setCategory(event.target.value)} required>
            <option value="">Selecciona una categoría</option><option value="POLITICA">Política</option><option value="PROCEDIMIENTO">Procedimiento</option><option value="DOCUMENTO_PUBLICO">Documento público</option>
          </select></div>
          <div className="field"><label htmlFor="review-effective-date">Fecha de vigencia (opcional)</label><input id="review-effective-date" type="date" value={effectiveDate} onChange={(event) => setEffectiveDate(event.target.value)} /></div>
          <div className="field"><label htmlFor="review-legal-sources">Fuentes oficiales verificadas</label><textarea id="review-legal-sources" rows="3" value={legalSourcesText} onChange={(event) => setLegalSourcesText(event.target.value)} placeholder="Una URL oficial por línea" required /><span className="field-hint">Usa URLs oficiales HTTPS del MTSS, SCIJ/PGR, CCSS, PRODHAB u otra fuente permitida por el backend.</span></div>
          <label className="admin-review-check"><input type="checkbox" checked={reviewedNoPersonalData} onChange={(event) => setReviewedNoPersonalData(event.target.checked)} /> Confirmo que revisé el documento y no contiene datos personales.</label>
          <label className="admin-review-check"><input type="checkbox" checked={reviewedNormativeContent} onChange={(event) => setReviewedNormativeContent(event.target.checked)} /> Confirmo que revisé el contenido frente a las fuentes normativas oficiales indicadas.</label>
          <Button type="submit" disabled={!canApprove || candidateBusy} icon="verified_user">{candidateBusy ? 'Guardando…' : 'Registrar aprobación'}</Button>
        </form>}
        {selectedCandidate?.status === 'APROBADO_PARA_INGESTA' && !reviewStatus?.pilotComplete && <div className="admin-pilot-action">
          <p>Este documento tiene aprobación registrada. El piloto indexará únicamente este archivo para comprobar la extracción y los embeddings.</p>
          <Button icon="science" disabled={candidateBusy} onClick={runPilot}>{candidateBusy ? 'Ejecutando piloto…' : 'Ejecutar piloto y sincronizar carpeta'}</Button>
        </div>}
        {selectedCandidate?.status === 'APROBADO_PARA_INGESTA' && reviewStatus?.pilotComplete && <p className="admin-review-notice" role="status">El piloto ya está validado. Puedes cerrar esta ventana y sincronizar los documentos aprobados.</p>}
      </div>}
    </Modal>}
  </div>;
}
