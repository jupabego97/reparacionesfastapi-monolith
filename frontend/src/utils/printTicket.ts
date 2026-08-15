/** Abre el diálogo nativo de impresión (impresoras de red instaladas en el PC). */
export function openNativePrintDialog(html: string): void {
  if (typeof document === 'undefined') return;
  const iframe = document.createElement('iframe');
  iframe.setAttribute('title', 'Imprimir ticket de ingreso');
  iframe.setAttribute('aria-hidden', 'true');
  Object.assign(iframe.style, {
    position: 'fixed',
    right: '0',
    bottom: '0',
    width: '0',
    height: '0',
    border: '0',
  });
  document.body.appendChild(iframe);
  const win = iframe.contentWindow;
  const doc = iframe.contentDocument;
  if (!win || !doc) {
    iframe.remove();
    window.print();
    return;
  }
  const cleanup = () => {
    iframe.remove();
  };
  win.addEventListener('afterprint', cleanup);
  doc.open();
  doc.write(html);
  doc.close();
  const trigger = () => {
    try {
      win.focus();
      win.print();
    } catch {
      cleanup();
    }
  };
  if (iframe.contentDocument?.readyState === 'complete') {
    window.setTimeout(trigger, 60);
  } else {
    iframe.addEventListener('load', () => window.setTimeout(trigger, 60), { once: true });
  }
}
