import { MaterialIcon } from './MaterialIcon';

export function Button({ children, variant = 'primary', size = 'md', icon, iconRight, className = '', type = 'button', ...props }) {
  return <button className={`button button-${variant} button-${size} ${className}`.trim()} type={type} {...props}>
    {icon && <MaterialIcon name={icon} />}
    <span>{children}</span>
    {iconRight && <MaterialIcon name={iconRight} />}
  </button>;
}
