import { useMemo } from 'react';
import { useApiResource } from '../../hooks/useApiResource';
import { hrService } from '../../services/hrService';
import { AdminStatusBadge, AdminTable } from '../../components/admin/AdminTable';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/PageHeader';
import { LoadingBlock, ResourceError } from '../../components/ResourceState';
import { formatDate, formatNumber, displayLabel } from '../../utils/format';

function localDate(value = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Costa_Rica', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(value);
  const dateParts = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map(({ type, value: partValue }) => [type, partValue]));
  return `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
}

function daysSince(value) {
  const raw = String(value || '');
  if (!raw) return 0;
  const parsed = new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw) ? raw : `${raw.replace(' ', 'T')}Z`);
  if (Number.isNaN(parsed.getTime())) return 0;
  const created = localDate(parsed);
  return Math.max(0, Math.floor((Date.parse(`${localDate()}T00:00:00Z`) - Date.parse(`${created}T00:00:00Z`)) / 86400000));
}

export function HRRequestsPage() {
  const { data, loading, error, reload } = useApiResource(() => hrService.admin.requests({ page: 1, pageSize: 200 }), []);
  const { data: departments } = useApiResource(hrService.admin.departments, []);
  const requests = useMemo(() => (data?.items || []).map((item) => ({ ...item, employee: `${item.firstName || ''} ${item.lastName || ''}`.trim(), daysWithoutResponse: daysSince(item.createdAt) })), [data]);
  const departmentOptions = [...new Set((departments || []).map((item) => item.name).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es-CR'));
  return <div className="admin-page">
    <PageHeader eyebrow="GESTIÓN DE PERSONAS" title="Solicitudes" description="Consulta solicitudes y prioriza las pendientes que llevan más de tres días sin respuesta." />
    <Card className="admin-content-card">
      {loading ? <LoadingBlock lines={6} /> : error ? <ResourceError error={error} onRetry={reload} /> : <AdminTable
        rows={requests}
        rowKey="id"
        caption="Solicitudes de colaboradores"
        searchPlaceholder="Colaborador, código, tipo o departamento"
        searchFields={['employee', 'code', 'type', 'department']}
        filters={[
          { key: 'status', label: 'Estado', options: ['PENDIENTE', 'APROBADA', 'RECHAZADA', 'CANCELADA'].map((value) => ({ value, label: displayLabel(value) })) },
          { key: 'department', label: 'Departamento', options: departmentOptions }
        ]}
        rowClassName={(row) => row.status === 'PENDIENTE' && row.daysWithoutResponse > 3 ? 'admin-row-overdue' : ''}
        columns={[
          { key: 'employee', label: 'Colaborador', render: (row) => <div className="admin-person-cell"><strong>{row.employee || 'Nombre no disponible'}</strong><small>{row.code}</small></div> },
          { key: 'department', label: 'Departamento' },
          { key: 'type', label: 'Tipo', render: (row) => displayLabel(row.type) },
          { key: 'startDate', label: 'Período', sortValue: (row) => row.startDate, render: (row) => <span>{formatDate(row.startDate)}<small className="admin-cell-subline">al {formatDate(row.endDate)}</small></span> },
          { key: 'requestedDays', label: 'Días', render: (row) => formatNumber(row.requestedDays, 2) },
          { key: 'createdAt', label: 'Recibida', render: (row) => <span>{formatDate(row.createdAt)}{row.status === 'PENDIENTE' && row.daysWithoutResponse > 3 && <small className="admin-overdue-label">{row.daysWithoutResponse} días sin respuesta</small>}</span> },
          { key: 'status', label: 'Estado', render: (row) => <AdminStatusBadge value={row.status} /> }
        ]}
      />}
      {data?.pagination && <p className="admin-api-limit-note">Mostrando hasta {formatNumber(data.pagination.pageSize, 0)} registros por consulta.</p>}
    </Card>
  </div>;
}
