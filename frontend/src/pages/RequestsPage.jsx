import { useMemo, useState } from 'react';
import { hrService } from '../services/hrService';
import { displayLabel, formatDate, formatNumber } from '../utils/format';
import { useApiResource } from '../hooks/useApiResource';
import { LoadingBlock, ResourceError } from '../components/ResourceState';
import { PageHeader } from '../components/PageHeader';
import { Card } from '../components/ui/Card';
import { DataTable } from '../components/ui/DataTable';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/Feedback';
import { SelectField } from '../components/ui/SelectField';

export function RequestsPage() {
  const { data: requests, loading, error, reload } = useApiResource(hrService.employee.requests, []);
  const [filter, setFilter] = useState('TODAS');
  const visibleRequests = useMemo(() => (requests || []).filter((request) => filter === 'TODAS' || request.estado === filter), [requests, filter]);
  return <>
    <PageHeader eyebrow="GESTIONES" title="Mis solicitudes" description="Consulta el estado y las fechas de tus solicitudes registradas." />
    <Card className="content-card">
      <div className="table-toolbar"><div><p className="eyebrow">HISTORIAL</p><h2>Solicitudes</h2></div><SelectField id="request-filter" className="compact-field" label="Filtrar por estado" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="TODAS">Todos los estados</option><option value="PENDIENTE">Pendientes</option><option value="APROBADA">Aprobadas</option><option value="RECHAZADA">Rechazadas</option><option value="CANCELADA">Canceladas</option></SelectField></div>
      {loading ? <LoadingBlock lines={5} /> : error ? <ResourceError error={error} onRetry={reload} /> : requests?.length ? visibleRequests.length ? <DataTable caption="Mis solicitudes de Recursos Humanos" rowKey="id" rows={visibleRequests} columns={[
        { key: 'tipo', label: 'Tipo', render: (row) => displayLabel(row.tipo) },
        { key: 'fecha_inicio', label: 'Desde', render: (row) => formatDate(row.fecha_inicio) },
        { key: 'fecha_fin', label: 'Hasta', render: (row) => formatDate(row.fecha_fin) },
        { key: 'dias_solicitados', label: 'Días', render: (row) => formatNumber(row.dias_solicitados) },
        { key: 'estado', label: 'Estado', render: (row) => <Badge value={row.estado} /> }
      ]} /> : <EmptyState icon="filter_alt_off" title="No hay solicitudes con este estado" text="Prueba con otro filtro para revisar tus registros." /> : <EmptyState icon="assignment" title="No hay solicitudes registradas" text="Las solicitudes asociadas a tu perfil aparecerán en esta lista." />}
    </Card>
  </>;
}
