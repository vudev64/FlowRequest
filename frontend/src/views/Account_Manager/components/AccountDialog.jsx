import { useEffect, useRef } from 'react';

export default function AccountDialog({ children, labelledBy, onClose, busy = false, wide = false }) {
  const panel = useRef(null);
  const handlers = useRef({ onClose, busy });
  useEffect(() => { handlers.current = { onClose, busy }; }, [onClose, busy]);
  useEffect(() => {
    const previous = document.activeElement;
    const element = panel.current;
    const focusables = () => [...element.querySelectorAll('a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')].filter(node => node.getClientRects().length);
    (focusables()[0] || element).focus();
    const handleKey = event => {
      if (event.key === 'Escape') { event.preventDefault(); if (!handlers.current.busy) handlers.current.onClose(); }
      if (event.key === 'Tab') {
        const nodes = focusables(), first = nodes[0], last = nodes.at(-1);
        if (!first) { event.preventDefault(); element.focus(); }
        else if (event.shiftKey && (document.activeElement === first || !element.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || !element.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => { document.removeEventListener('keydown', handleKey); if (previous?.isConnected) previous.focus(); };
  }, []);
  return <div className="acc-modal-layer" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section ref={panel} tabIndex={-1} className={`acc-modal${wide ? ' acc-detail' : ''}`} role="dialog" aria-modal="true" aria-labelledby={labelledBy} aria-busy={busy}>{children}</section>
  </div>;
}
