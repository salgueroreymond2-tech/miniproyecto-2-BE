export function Card({ children, className = '', as: Element = 'section', ...props }) {
  return <Element className={`surface-card ${className}`.trim()} {...props}>{children}</Element>;
}
