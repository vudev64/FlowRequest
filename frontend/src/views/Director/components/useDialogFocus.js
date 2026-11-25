import { useEffect, useRef } from 'react';

export function useDialogFocus(ref, open, onClose, busy = false) {
  const handlers = useRef({ onClose, busy });
  useEffect(() => { handlers.current = { onClose, busy }; }, [onClose, busy]);
  useEffect(() => {
    if (!open || !ref.current) return;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current.focus();
    const onKey = event => {
      if (event.key === 'Escape' && !handlers.current.busy) {
        event.preventDefault(); handlers.current.onClose();
      }
      if (event.key !== 'Tab') return;
      const nodes = [...ref.current.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]')].filter(node => node.getClientRects().length);
      const first = nodes[0], last = nodes.at(-1);
      if (!first) { event.preventDefault(); ref.current.focus(); }
      else if (event.shiftKey && (document.activeElement === first || !nodes.includes(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !nodes.includes(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus();
    };
  }, [open, ref]);
}
