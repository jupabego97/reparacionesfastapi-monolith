import { useEffect, useMemo, useRef } from 'react';
import type { TicketIngresoData } from '../utils/ingresoTicket';
import { buildIngresoTicketHtml, ticketFields } from '../utils/ingresoTicket';
import { openNativePrintDialog } from '../utils/printTicket';

interface Props {
  ticket: TicketIngresoData;
  notice?: string;
  waFallbackUrl?: string | null;
  onDone: () => void;
}

export default function TicketIngresoDialog({ ticket, notice, waFallbackUrl, onDone }: Props) {
  const html = useMemo(
    () => buildIngresoTicketHtml(ticket, window.location.origin),
    [ticket],
  );
  const fields = useMemo(() => ticketFields(ticket, window.location.origin), [ticket]);
  const autoPrinted = useRef(false);

  useEffect(() => {
    if (autoPrinted.current) return;
    autoPrinted.current = true;
    const timer = window.setTimeout(() => openNativePrintDialog(html), 250);
    return () => window.clearTimeout(timer);
  }, [html]);

  return (
    <div className="ticket-dialog-overlay" role="dialog" aria-modal="true" aria-labelledby="ticket-dialog-title">
      <div className="ticket-dialog">
        <h3 id="ticket-dialog-title">
          <i className="fas fa-print" aria-hidden="true" /> Ticket de ingreso
        </h3>
        <p className="ticket-dialog-lead">
          {notice || 'WhatsApp enviado. Seleccione la impresora de la red de la empresa para entregar el ticket al cliente.'}
        </p>
        <div className="ticket-preview" aria-label="Vista previa del ticket">
          <div className="ticket-preview-brand">NANOTRONICS</div>
          <div className="ticket-preview-folio">FOLIO #{ticket.id}</div>
          {fields.map(f => (
            <div key={f.label} className="ticket-preview-row">
              <span>{f.label}</span>
              <strong>{f.value}</strong>
            </div>
          ))}
        </div>
        <div className="ticket-dialog-actions">
          <button type="button" className="btn-save" onClick={() => openNativePrintDialog(html)}>
            <i className="fas fa-print" aria-hidden="true" /> Imprimir ticket
          </button>
          {waFallbackUrl && (
            <a className="btn-cancel" href={waFallbackUrl}>
              <i className="fab fa-whatsapp" aria-hidden="true" /> Abrir WhatsApp
            </a>
          )}
          <button type="button" className="btn-cancel" onClick={onDone}>
            Listo
          </button>
        </div>
      </div>
    </div>
  );
}
