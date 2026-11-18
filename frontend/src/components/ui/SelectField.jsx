export function SelectField({ id, label, children, error, className = '', ...props }) {
  return <div className={`field ${className}`.trim()}>
    <label htmlFor={id}>{label}</label>
    <select id={id} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} {...props}>{children}</select>
    {error && <span className="field-error" id={`${id}-error`}>{error}</span>}
  </div>;
}
