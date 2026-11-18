import { useMemo, useState } from 'react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/Feedback';
import { Field } from '../ui/Field';
import { MaterialIcon } from '../ui/MaterialIcon';

function normalize(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-CR');
}

function compare(left, right) {
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  if (String(left ?? '').trim() && String(right ?? '').trim() && Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) return leftNumber - rightNumber;
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);
  if (!Number.isNaN(leftTime) && !Number.isNaN(rightTime)) return leftTime - rightTime;
  return String(left ?? '').localeCompare(String(right ?? ''), 'es-CR', { sensitivity: 'base' });
}

function FilterSelect({ filter, value, onChange, id }) {
  return <label className="admin-filter" htmlFor={id}>
    <span>{filter.label}</span>
    <select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">Todos</option>
      {filter.options.map((option) => {
        const item = typeof option === 'string' ? { value: option, label: option } : option;
        return <option key={item.value} value={item.value}>{item.label}</option>;
      })}
    </select>
  </label>;
}

export function AdminTable({
  rows = [], columns, rowKey = 'id', caption, searchFields = [], searchPlaceholder = 'Buscar', filters = [], pageSizeOptions = [10, 25, 50], rowClassName
}) {
  const [search, setSearch] = useState('');
  const [filterValues, setFilterValues] = useState({});
  const [sort, setSort] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(pageSizeOptions[0]);

  const filteredRows = useMemo(() => {
    let result = (rows || []).filter((row) => {
      const matchesSearch = !search || searchFields.some((field) => normalize(typeof field === 'function' ? field(row) : row[field]).includes(normalize(search)));
      const matchesFilters = filters.every((filter) => !filterValues[filter.key] || String(row[filter.key] ?? '') === filterValues[filter.key]);
      return matchesSearch && matchesFilters;
    });
    if (sort) {
      const column = columns.find((item) => item.key === sort.key);
      const valueFor = column?.sortValue || ((row) => row[sort.key]);
      result = [...result].sort((left, right) => compare(valueFor(left), valueFor(right)) * (sort.direction === 'ASC' ? 1 : -1));
    }
    return result;
  }, [rows, search, searchFields, filters, filterValues, sort, columns]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function updateSearch(value) { setSearch(value); setPage(1); }
  function updateFilter(key, value) { setFilterValues((current) => ({ ...current, [key]: value })); setPage(1); }
  function toggleSort(column) {
    if (column.sortable === false) return;
    setSort((current) => current?.key === column.key
      ? { key: column.key, direction: current.direction === 'ASC' ? 'DESC' : 'ASC' }
      : { key: column.key, direction: column.defaultDirection || 'ASC' });
  }

  return <div className="admin-table-wrap">
    <div className="admin-table-toolbar">
      <Field id={`${rowKey}-search`} label="Buscar registros" className="admin-search-field" type="search" placeholder={searchPlaceholder} value={search} onChange={(event) => updateSearch(event.target.value)} />
      <div className="admin-filter-list">
        {filters.map((filter) => <FilterSelect key={filter.key} filter={filter} id={`${rowKey}-${filter.key}`} value={filterValues[filter.key] || ''} onChange={(value) => updateFilter(filter.key, value)} />)}
      </div>
      <label className="admin-filter admin-page-size" htmlFor={`${rowKey}-page-size`}><span>Filas</span><select id={`${rowKey}-page-size`} value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}>{pageSizeOptions.map((size) => <option key={size} value={size}>{size}</option>)}</select></label>
    </div>
    {visibleRows.length ? <div className="admin-table-scroll"><table className="data-table admin-data-table">
      {caption && <caption>{caption}</caption>}
      <thead><tr>{columns.map((column) => <th scope="col" key={column.key}>
        <button type="button" className="admin-sort-button" onClick={() => toggleSort(column)} aria-label={`Ordenar por ${column.label}`}>
          {column.label}{sort?.key === column.key && <MaterialIcon name={sort.direction === 'ASC' ? 'arrow_upward' : 'arrow_downward'} />}
        </button>
      </th>)}</tr></thead>
      <tbody>{visibleRows.map((row, index) => <tr key={row[rowKey] ?? `${index}`} className={rowClassName?.(row) || ''}>
        {columns.map((column) => <td key={column.key}>{column.render ? column.render(row) : row[column.key] ?? '—'}</td>)}
      </tr>)}</tbody>
    </table></div> : <EmptyState icon="search_off" title="No hay resultados" text={rows.length ? 'Ajusta la búsqueda o los filtros para ver registros.' : 'No hay registros disponibles para mostrar.'} />}
    <div className="admin-table-footer"><span>{filteredRows.length ? `Mostrando ${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filteredRows.length)} de ${filteredRows.length}` : '0 resultados'}</span><div className="admin-pagination"><Button variant="secondary" size="sm" icon="chevron_left" aria-label="Página anterior" disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} /><span>Página {currentPage} de {pageCount}</span><Button variant="secondary" size="sm" icon="chevron_right" aria-label="Página siguiente" disabled={currentPage >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))} /></div></div>
  </div>;
}

export function AdminStatusBadge({ value, label }) {
  const normalized = String(value || '').toUpperCase();
  const tone = ['COMPLETADA', 'COMPLETADO', 'VALIDADO', 'ACTIVO', 'RESPONDIDA', 'APROBADA'].includes(normalized) ? 'success'
    : ['EN_PROCESO', 'PENDIENTE', 'EN_REVISION', 'PROGRAMADO', 'SIN_EVIDENCIA'].includes(normalized) ? 'warning'
      : ['FALLIDA', 'ERROR', 'RECHAZADA', 'ELIMINADO', 'CANCELADA'].includes(normalized) ? 'danger' : 'neutral';
  return <Badge value={value} tone={tone}>{label || String(value || '—').replaceAll('_', ' ')}</Badge>;
}
