const labels = {
  PENDIENTE: 'Pendiente', APROBADA: 'Aprobada', RECHAZADA: 'Rechazada', CANCELADA: 'Cancelada',
  PROGRAMADO: 'Programado', PROCESADO: 'Procesado', ACTIVO: 'Activo', INACTIVO: 'Inactivo',
  SUSPENDIDO: 'Suspendido', COLABORADOR: 'Colaborador', RRHH: 'Recursos Humanos'
};

export function Badge({ value, children, tone, className = '' }) {
  const normalized = String(value || '').toUpperCase();
  const semanticTone = tone || (['APROBADA', 'PROCESADO', 'ACTIVO'].includes(normalized) ? 'success'
    : ['PENDIENTE', 'PROGRAMADO', 'SUSPENDIDO'].includes(normalized) ? 'warning'
      : ['RECHAZADA', 'CANCELADA', 'INACTIVO'].includes(normalized) ? 'danger' : 'neutral');
  return <span className={`badge badge-${semanticTone} ${className}`.trim()}>{children || labels[normalized] || value}</span>;
}
