export function DataTable({ columns, rows, rowKey = 'id', caption }) {
  return <div className="table-scroll">
    <table className="data-table">
      {caption && <caption>{caption}</caption>}
      <thead><tr>{columns.map((column) => <th scope="col" key={column.key}>{column.label}</th>)}</tr></thead>
      <tbody>
        {rows.map((row, index) => <tr key={row[rowKey] ?? `${index}`}>
          {columns.map((column) => <td key={column.key}>{column.render ? column.render(row) : row[column.key] ?? '—'}</td>)}
        </tr>)}
      </tbody>
    </table>
  </div>;
}
