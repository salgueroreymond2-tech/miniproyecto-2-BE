import { ErrorState, Skeleton } from './ui/Feedback';

export function LoadingBlock({ lines = 3 }) {
  return <div className="loading-block" role="status" aria-label="Cargando información">
    {Array.from({ length: lines }, (_, index) => <Skeleton key={index} className={index === 0 ? 'skeleton-wide' : ''} />)}
  </div>;
}

export function ResourceError({ error, onRetry }) {
  const status = error?.response?.status;
  const message = status === 401 ? 'Tu sesión terminó. Ingresa nuevamente para continuar.'
    : status === 503 ? 'El servicio de datos no está disponible por el momento.'
      : error?.response?.data?.error || 'Ocurrió un problema al consultar la información.';
  return <ErrorState message={message} onRetry={onRetry} />;
}
