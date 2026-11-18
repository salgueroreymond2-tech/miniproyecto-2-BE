import { createContext, useCallback, useContext, useState } from 'react';
import { MaterialIcon } from './MaterialIcon';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const dismiss = useCallback((id) => setItems((current) => current.filter((item) => item.id !== id)), []);
  const notify = useCallback((message, tone = 'success') => {
    const id = `${Date.now()}-${Math.random()}`;
    setItems((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => dismiss(id), 4200);
  }, [dismiss]);

  return <ToastContext.Provider value={notify}>
    {children}
    <div className="toast-region" aria-live="polite" aria-relevant="additions">
      {items.map((item) => <div className={`toast toast-${item.tone}`} role="status" key={item.id}>
        <MaterialIcon name={item.tone === 'error' ? 'error' : 'check_circle'} />
        <span>{item.message}</span>
        <button type="button" aria-label="Descartar notificación" onClick={() => dismiss(item.id)}><MaterialIcon name="close" /></button>
      </div>)}
    </div>
  </ToastContext.Provider>;
}

export function useToast() {
  const notify = useContext(ToastContext);
  if (!notify) throw new Error('useToast debe usarse dentro de ToastProvider.');
  return notify;
}
