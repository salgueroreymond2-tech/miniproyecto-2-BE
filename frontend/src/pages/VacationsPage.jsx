import { hrService } from '../services/hrService';
import { formatNumber } from '../utils/format';
import { useApiResource } from '../hooks/useApiResource';
import { LoadingBlock, ResourceError } from '../components/ResourceState';
import { PageHeader } from '../components/PageHeader';
import { Card } from '../components/ui/Card';
import { DataTable } from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/Feedback';
import { MaterialIcon } from '../components/ui/MaterialIcon';

function BalanceMetric({ icon, label, value, helper }) {
  return <div className="balance-metric"><span><MaterialIcon name={icon} /></span><div><small>{label}</small><strong>{formatNumber(value)} <em>días</em></strong>{helper && <small className="metric-helper">{helper}</small>}</div></div>;
}

export function VacationsPage() {
  const { data: balances, loading, error, reload } = useApiResource(hrService.employee.vacations, []);
  const latest = balances?.[0];
  return <>
    <PageHeader eyebrow="TIEMPO LIBRE" title="Mis vacaciones" description="Consulta los saldos que constan en tus registros de Recursos Humanos." />
    {loading ? <Card><LoadingBlock lines={4} /></Card> : error ? <ResourceError error={error} onRetry={reload} /> : balances?.length ? <>
      <Card className="balance-feature"><div className="balance-feature-heading"><div><p className="eyebrow">SALDO MÁS RECIENTE</p><h2>Período {latest.periodo_anual}</h2></div><span className="balance-feature-icon"><MaterialIcon name="beach_access" /></span></div>
        <div className="balance-metrics"><BalanceMetric icon="event_available" label="Disponibles" value={latest.dias_disponibles} /><BalanceMetric icon="calendar_add_on" label="Generados" value={latest.dias_generados} /><BalanceMetric icon="event_busy" label="Disfrutados" value={latest.dias_disfrutados} /></div>
        <p className="balance-note"><MaterialIcon name="info" />El saldo mostrado corresponde a los datos registrados en el sistema. Para aclaraciones, contacta a RRHH.</p>
      </Card>
      <Card className="content-card"><div className="section-heading"><div><p className="eyebrow">DETALLE</p><h2>Historial por período</h2></div></div>
        <DataTable caption="Saldos de vacaciones por período" rowKey="periodo_anual" rows={balances} columns={[
          { key: 'periodo_anual', label: 'Período' },
          { key: 'dias_generados', label: 'Generados', render: (row) => formatNumber(row.dias_generados) },
          { key: 'dias_disfrutados', label: 'Disfrutados', render: (row) => formatNumber(row.dias_disfrutados) },
          { key: 'dias_disponibles', label: 'Disponibles', render: (row) => <strong>{formatNumber(row.dias_disponibles)}</strong> }
        ]} />
      </Card>
    </> : <Card><EmptyState icon="beach_access" title="No hay saldos registrados" text="Cuando Recursos Humanos registre tus saldos, se mostrarán aquí." /></Card>}
  </>;
}
