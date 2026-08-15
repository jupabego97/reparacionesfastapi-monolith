import { formatDateTimeColombia, formatYmdColombiaShort } from './colombiaTime';

export const ESTADO_TICKET: Record<string, string> = {
  ingresado: 'Ingresado',
  diagnosticada: 'En diagnóstico',
  para_entregar: 'Listo para entregar',
  listos: 'Entregado',
};

export const PRIORIDAD_TICKET: Record<string, string> = {
  alta: 'Alta',
  media: 'Media',
  baja: 'Baja',
};

export type TicketIngresoData = {
  id: number;
  nombre_propietario?: string | null;
  problema?: string | null;
  whatsapp?: string | null;
  fecha_inicio?: string | null;
  fecha_limite?: string | null;
  columna?: string | null;
  tiene_cargador?: string | null;
  prioridad?: string | null;
  asignado_nombre?: string | null;
  costo_estimado?: number | null;
  costo_final?: number | null;
  notas_tecnicas?: string | null;
  tracking_token?: string | null;
  tags?: { name: string }[];
};

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildSeguimientoUrl(
  token: string | null | undefined,
  origin: string = typeof window !== 'undefined' ? window.location.origin : '',
): string | null {
  const tok = (token || '').trim();
  if (!tok || !origin) return null;
  return `${origin.replace(/\/$/, '')}/seguimiento/${encodeURIComponent(tok)}`;
}

export function formatCop(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(Number(amount))) return '';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

export function ticketEstadoLabel(key: string | null | undefined): string {
  if (!key) return 'Ingresado';
  return ESTADO_TICKET[key] || key.replace(/_/g, ' ');
}

export type TicketField = { label: string; value: string };

export function ticketFields(data: TicketIngresoData, origin?: string): TicketField[] {
  const fields: TicketField[] = [
    { label: 'Cliente', value: (data.nombre_propietario || 'Cliente').trim() || 'Cliente' },
    { label: 'WhatsApp', value: (data.whatsapp || '').trim() || '—' },
    { label: 'Estado', value: ticketEstadoLabel(data.columna) },
    { label: 'Prioridad', value: PRIORIDAD_TICKET[data.prioridad || ''] || data.prioridad || 'Media' },
    {
      label: 'Ingreso',
      value: data.fecha_inicio ? formatDateTimeColombia(data.fecha_inicio) : '—',
    },
    {
      label: 'Fecha límite',
      value: data.fecha_limite ? formatYmdColombiaShort(data.fecha_limite) : '—',
    },
    {
      label: 'Cargador',
      value: data.tiene_cargador === 'no' ? 'No' : data.tiene_cargador === 'si' ? 'Sí' : (data.tiene_cargador || '—'),
    },
  ];
  if (data.asignado_nombre) {
    fields.push({ label: 'Técnico', value: data.asignado_nombre });
  }
  const estimado = formatCop(data.costo_estimado);
  if (estimado) fields.push({ label: 'Costo est.', value: estimado });
  const final = formatCop(data.costo_final);
  if (final) fields.push({ label: 'Costo final', value: final });
  const tags = (data.tags || []).map(t => t.name).filter(Boolean);
  if (tags.length) fields.push({ label: 'Etiquetas', value: tags.join(', ') });
  const problema = (data.problema || '').trim() || 'Sin descripción';
  fields.push({ label: 'Problema', value: problema });
  const notas = (data.notas_tecnicas || '').trim();
  if (notas) fields.push({ label: 'Notas', value: notas });
  const seguimiento = buildSeguimientoUrl(data.tracking_token, origin);
  if (seguimiento) fields.push({ label: 'Seguimiento', value: seguimiento });
  return fields;
}

const TICKET_CSS = `
  @page { size: auto; margin: 6mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; color: #111; }
  body { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace; }
  .ticket { width: 72mm; max-width: 100%; margin: 0 auto; font-size: 11px; line-height: 1.35; }
  .brand { text-align: center; border-bottom: 1px dashed #111; padding-bottom: 8px; margin-bottom: 8px; }
  .brand h1 { margin: 0; font-size: 16px; letter-spacing: 0.04em; }
  .brand p { margin: 2px 0 0; font-size: 10px; }
  .folio { text-align: center; font-size: 22px; font-weight: 700; margin: 8px 0; }
  .row { display: flex; gap: 6px; margin: 3px 0; align-items: flex-start; }
  .lbl { flex: 0 0 28mm; font-weight: 700; text-transform: uppercase; font-size: 9px; }
  .val { flex: 1; word-break: break-word; }
  .hint { margin-top: 10px; border-top: 1px dashed #111; padding-top: 8px; text-align: center; font-size: 10px; }
`;

export function buildIngresoTicketHtml(data: TicketIngresoData, origin?: string): string {
  const fields = ticketFields(data, origin);
  const rows = fields
    .map(f => `<div class="row"><div class="lbl">${escapeHtml(f.label)}</div><div class="val">${escapeHtml(f.value)}</div></div>`)
    .join('');
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Ticket #${escapeHtml(String(data.id))}</title>
  <style>${TICKET_CSS}</style>
</head>
<body>
  <div class="ticket">
    <div class="brand">
      <h1>NANOTRONICS</h1>
      <p>Comprobante de ingreso</p>
    </div>
    <div class="folio">FOLIO #${escapeHtml(String(data.id))}</div>
    ${rows}
    <p class="hint">Conserve este ticket para recoger su equipo. Le avisaremos por WhatsApp cuando haya novedades.</p>
  </div>
</body>
</html>`;
}
