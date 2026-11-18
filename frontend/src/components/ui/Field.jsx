export function Field({ label, id, error, hint, className = '', ...props }) {
  return <div className={`field ${className}`.trim()}>
    <label htmlFor={id}>{label}</label>
    <input id={id} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined} {...props} />
    {error && <span className="field-error" id={`${id}-error`}>{error}</span>}
    {!error && hint && <span className="field-hint" id={`${id}-hint`}>{hint}</span>}
  </div>;
}
