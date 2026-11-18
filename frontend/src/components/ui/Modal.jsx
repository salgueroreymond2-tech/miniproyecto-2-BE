import { useEffect, useRef } from 'react';
import { Button } from './Button';
import { MaterialIcon } from './MaterialIcon';

export function Modal({ title, children, onClose, actions }) {
  const closeRef = useRef(null);
  const panelRef = useRef(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab') return;
      const focusable = panelRef.current?.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])');
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={panelRef} className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <header className="modal-header"><h2 id="modal-title">{title}</h2><Button ref={closeRef} variant="quiet" size="sm" icon="close" aria-label="Cerrar diálogo" onClick={onClose} /></header>
      <div className="modal-content">{children}</div>
      {actions && <footer className="modal-actions">{actions}</footer>}
    </section>
  </div>;
}
