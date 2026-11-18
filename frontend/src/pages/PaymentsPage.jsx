import { hrService } from '../services/hrService';
import { displayLabel, formatDate } from '../utils/format';
import { useApiResource } from '../hooks/useApiResource';
import { LoadingBlock, ResourceError } from '../components/ResourceState';
import { PageHeader } from '../components/PageHeader';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/Feedback';
import { MaterialIcon } from '../components/ui/MaterialIcon';

export function PaymentsPage() {
  const { data: payment, loading, error, reload } = useApiResource(hrService.employee.nextPayment, []);
  return <>
    <PageHeader eyebrow="CALENDARIO" title="Próximos pagos" description="Revisa la próxima fecha de pago programada en el calendario corporativo." />
    {loading ? <Card><LoadingBlock lines={3} /></Card> : error ? <ResourceError error={error} onRetry={reload} /> : payment ? <Card className="payment-feature">
      <span className="payment-symbol"><MaterialIcon name="payments" /></span>
      <p className="eyebrow">PRÓXIMO PAGO PROGRAMADO</p>
      <h2>{formatDate(payment.fecha_pago, { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
      <div className="payment-meta"><span><MaterialIcon name="event_repeat" />{displayLabel(payment.tipo)}</span><span><MaterialIcon name="schedule" />Fecha registrada en MySQL</span></div>
      {(payment.fecha_corte_inicio || payment.fecha_corte_fin) && <div className="pay-period"><span>Período de corte</span><strong>{formatDate(payment.fecha_corte_inicio)} — {formatDate(payment.fecha_corte_fin)}</strong></div>}
      <p className="balance-note"><MaterialIcon name="info" />La fecha es la que consta en el calendario. Para dudas sobre tu pago, contacta a RRHH.</p>
    </Card> : <Card><EmptyState icon="event_busy" title="No hay un pago programado disponible" text="El calendario no contiene una próxima fecha de pago para mostrar." /></Card>}
  </>;
}
