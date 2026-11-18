export function formatDate(value, options = {}) {
  if (!value) return '—';
  const date = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T12:00:00`)
    : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-CR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Costa_Rica', ...options }).format(date);
}

export function formatNumber(value, maximumFractionDigits = 2) {
  if (value === null || value === undefined || value === '') return '—';
  const number = Number(value);
  return Number.isFinite(number) ? new Intl.NumberFormat('es-CR', { maximumFractionDigits }).format(number) : '—';
}

export function displayLabel(value) {
  if (!value) return '—';
  return String(value).toLowerCase().replaceAll('_', ' ').replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());
}
