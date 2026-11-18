import { useMemo, useState } from 'react';
import { hrService } from '../services/hrService';
import { displayLabel } from '../utils/format';
import { useApiResource } from '../hooks/useApiResource';
import { LoadingBlock, ResourceError } from '../components/ResourceState';
import { PageHeader } from '../components/PageHeader';
import { Card } from '../components/ui/Card';
import { DataTable } from '../components/ui/DataTable';
import { Badge } from '../components/ui/Badge';
import { Field } from '../components/ui/Field';
import { EmptyState } from '../components/ui/Feedback';

export function HRDirectoryPage() {
  const { data: employees, loading, error, reload } = useApiResource(hrService.hr.employees, []);
  const [search, setSearch] = useState('');
  const rows = useMemo(() => (employees || []).filter((employee) => `${employee.nombres} ${employee.apellidos} ${employee.codigo} ${employee.departamento} ${employee.puesto}`.toLowerCase().includes(search.toLowerCase())), [employees, search]);
  return <>
    <PageHeader eyebrow="RECURSOS HUMANOS" title="Directorio de colaboradores" description="Directorio consultado desde el servicio de Recursos Humanos." />
    <Card className="content-card">
      <div className="table-toolbar"><div><p className="eyebrow">DIRECTORIO</p><h2>Colaboradores</h2></div><Field id="employee-search" className="search-field" label="Buscar colaborador" type="search" placeholder="Nombre, código o departamento" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
      {loading ? <LoadingBlock lines={6} /> : error ? <ResourceError error={error} onRetry={reload} /> : rows.length ? <DataTable caption="Directorio de colaboradores de NexoTico" rowKey="codigo" rows={rows} columns={[
        { key: 'nombres', label: 'Colaborador', render: (row) => <div className="employee-table-name"><span className="employee-avatar">{row.nombres?.slice(0, 1)}{row.apellidos?.slice(0, 1)}</span><div><strong>{row.nombres} {row.apellidos}</strong><small>{row.codigo}</small></div></div> },
        { key: 'departamento', label: 'Departamento' },
        { key: 'puesto', label: 'Puesto' },
        { key: 'estado', label: 'Estado', render: (row) => <Badge value={row.estado}>{displayLabel(row.estado)}</Badge> }
      ]} /> : <EmptyState icon="person_search" title="No encontramos colaboradores" text="No hay resultados que coincidan con la búsqueda." />}
    </Card>
  </>;
}
