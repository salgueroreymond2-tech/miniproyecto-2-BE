export function Tooltip({ label, children }) {
  return <span className="tooltip-wrap" title={label} aria-label={label}>{children}<span className="tooltip-bubble" role="tooltip">{label}</span></span>;
}
