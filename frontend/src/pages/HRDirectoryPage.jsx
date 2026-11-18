import { hrService } from '../services/hrService';
import { displayLabel } from '../utils/format';
import { useApiResource } from '../hooks/useApiResource';
import { LoadingBlock, ResourceError } from '../components/ResourceState';
import { PageHeader } from '../components/PageHeader';
import { Card } from '../components/ui/Card';
import { AdminStatusBadge, AdminTable } from '../components/admin/AdminTable';

export function HRDirectoryPage() {
  const { data: employees, loading, error, reload } = useApiResource(hrService.hr.employees, []);
  const departments = [...new Set((employees || []).map((row) => row.departamento).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es-CR'));
  const statuses = [...new Set((employees || []).map((row) => row.estado).filter(Boolean))];
  return <div className="admin-page">
    <PageHeader eyebrow="RECURSOS HUMANOS" title="Directorio de colaboradores" description="Directorio consultado desde la API interna de Recursos Humanos." />
    <Card className="admin-content-card">
      {loading ? <LoadingBlock lines={6} /> : error ? <ResourceError error={error} onRetry={reload} /> : <AdminTable rows={employees || []} rowKey="codigo" caption="Directorio de colaboradores de NexoTico" searchFields={['nombres', 'apellidos', 'codigo', 'departamento', 'puesto', 'email_corporativo']} searchPlaceholder="Nombre, código, puesto o departamento" filters={[{ key: 'departamento', label: 'Departamento', options: departments }, { key: 'estado', label: 'Estado', options: statuses }]} columns={[
        { key: 'nombres', label: 'Colaborador', render: (row) => <div className="admin-person-cell"><strong>{row.nombres} {row.apellidos}</strong><small>{row.codigo}</small></div> },
        { key: 'departamento', label: 'Departamento' },
        { key: 'puesto', label: 'Puesto' },
        { key: 'email_corporativo', label: 'Correo' },
        { key: 'estado', label: 'Estado', render: (row) => <AdminStatusBadge value={row.estado} label={displayLabel(row.estado)} /> }
      ]} />}
      <p className="admin-api-limit-note">La API limita el directorio a 200 colaboradores por consulta.</p>
    </Card>
  </div>;
}
