import { useApiResource } from '../../hooks/useApiResource';
import { hrService } from '../../services/hrService';
import { AdminTable } from '../../components/admin/AdminTable';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/PageHeader';
import { LoadingBlock, ResourceError } from '../../components/ResourceState';
import { formatNumber } from '../../utils/format';

export function HRDepartmentsPage() {
  const { data, loading, error, reload } = useApiResource(hrService.admin.departments, []);
  const departments = data || [];
  return <div className="admin-page">
    <PageHeader eyebrow="ESTRUCTURA ORGANIZACIONAL" title="Departamentos" description="Distribución de colaboradores por departamento, según los registros de MySQL." />
    <Card className="admin-content-card">
      {loading ? <LoadingBlock lines={5} /> : error ? <ResourceError error={error} onRetry={reload} /> : <AdminTable
        rows={departments}
        rowKey="id"
        caption="Departamentos registrados"
        searchFields={['name']}
        searchPlaceholder="Buscar departamento"
        columns={[
          { key: 'name', label: 'Departamento' },
          { key: 'collaborators', label: 'Colaboradores', render: (row) => formatNumber(row.collaborators, 0) },
          { key: 'activeCollaborators', label: 'Activos', render: (row) => formatNumber(row.activeCollaborators, 0) }
        ]}
      />}
    </Card>
  </div>;
}
