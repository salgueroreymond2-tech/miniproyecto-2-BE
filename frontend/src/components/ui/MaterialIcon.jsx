export function MaterialIcon({ name, className = '', decorative = true }) {
  return <span className={`material-symbols-rounded ${className}`} aria-hidden={decorative || undefined} role={decorative ? undefined : 'img'}>{name}</span>;
}
