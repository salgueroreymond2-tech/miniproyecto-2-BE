import { hrService } from '../services/hrService';
import { formatDate, displayLabel } from '../utils/format';
import { PageHeader } from '../components/PageHeader';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/Feedback';
import { LoadingBlock, ResourceError } from '../components/ResourceState';
import { useApiResource } from '../hooks/useApiResource';

export function ProfilePage() {
  const { data: profile, loading, error, reload } = useApiResource(hrService.employee.profile, []);
  return <>
    <PageHeader eyebrow="INFORMACIÓN PERSONAL" title="Mi perfil" description="Datos laborales asociados a tu cuenta en NexoTico." />
    <Card className="profile-card">
      {loading ? <LoadingBlock lines={6} /> : error ? <ResourceError error={error} onRetry={reload} /> : !profile ? <EmptyState icon="person_off" title="No encontramos un perfil asociado" /> : <>
        <div className="profile-banner"><span className="profile-avatar">{profile.nombres?.slice(0, 1)}{profile.apellidos?.slice(0, 1)}</span><div><p className="eyebrow">COLABORADOR</p><h2>{profile.nombres} {profile.apellidos}</h2><span>{profile.codigo}</span></div><Badge value={profile.estado} /></div>
        <dl className="detail-grid">
          <div><dt>Correo corporativo</dt><dd>{profile.email_corporativo || '—'}</dd></div>
          <div><dt>Departamento</dt><dd>{profile.departamento || '—'}</dd></div>
          <div><dt>Puesto</dt><dd>{profile.puesto || '—'}</dd></div>
          <div><dt>Modalidad de trabajo</dt><dd>{displayLabel(profile.modalidad)}</dd></div>
          <div><dt>Fecha de ingreso</dt><dd>{formatDate(profile.fecha_ingreso)}</dd></div>
          <div><dt>Identificador</dt><dd>{profile.codigo || '—'}</dd></div>
        </dl>
      </>}
    </Card>
  </>;
}
