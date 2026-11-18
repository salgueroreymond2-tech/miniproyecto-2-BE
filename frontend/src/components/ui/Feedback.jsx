import { MaterialIcon } from './MaterialIcon';
import { Button } from './Button';

export function Skeleton({ className = '' }) {
  return <span className={`skeleton ${className}`.trim()} aria-hidden="true" />;
}

export function EmptyState({ icon = 'inbox', title, children, text, action }) {
  return <div className="empty-state">
    <span className="empty-icon"><MaterialIcon name={icon} /></span>
    <h3>{title}</h3>
    {(children || text) && <p>{children || text}</p>}
    {action}
  </div>;
}

export function ErrorState({ title = 'No pudimos cargar esta información', message, onRetry }) {
  return <div className="error-state" role="alert">
    <span className="error-icon"><MaterialIcon name="cloud_off" /></span>
    <div><strong>{title}</strong><p>{message || 'Revisa tu conexión e inténtalo de nuevo.'}</p></div>
    {onRetry && <Button variant="secondary" size="sm" icon="refresh" onClick={onRetry}>Reintentar</Button>}
  </div>;
}
