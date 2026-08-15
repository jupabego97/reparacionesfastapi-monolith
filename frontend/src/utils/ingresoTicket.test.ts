import { describe, expect, it } from 'vitest';
import { buildIngresoTicketHtml, buildSeguimientoUrl, escapeHtml, ticketFields } from './ingresoTicket';

describe('ingresoTicket', () => {
  const sample = {
    id: 42,
    nombre_propietario: 'Ana Pérez',
    problema: 'Pantalla rota',
    whatsapp: '3001234567',
    fecha_inicio: '2026-08-15T15:00:00Z',
    fecha_limite: '2026-08-16',
    columna: 'ingresado',
    tiene_cargador: 'si',
    prioridad: 'alta',
    asignado_nombre: 'Carlos',
    costo_estimado: 150000,
    notas_tecnicas: 'Revisar flex',
    tracking_token: 'tok_abc',
    tags: [{ name: 'iPhone' }],
  };

  it('incluye folio, cliente y problema', () => {
    const html = buildIngresoTicketHtml(sample, 'https://nano.example');
    expect(html).toContain('FOLIO #42');
    expect(html).toContain('Ana Pérez');
    expect(html).toContain('Pantalla rota');
    expect(html).toContain('3001234567');
    expect(html).toContain('Carlos');
    expect(html).toContain('iPhone');
    expect(html).toContain('https://nano.example/seguimiento/tok_abc');
  });

  it('escapa HTML en datos del cliente', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
    const html = buildIngresoTicketHtml({
      id: 1,
      nombre_propietario: '<b>Hack</b>',
      problema: 'a & b',
    });
    expect(html).toContain('&lt;b&gt;Hack&lt;/b&gt;');
    expect(html).not.toContain('<b>Hack</b>');
  });

  it('arma URL de seguimiento', () => {
    expect(buildSeguimientoUrl('abc', 'https://app.test')).toBe('https://app.test/seguimiento/abc');
    expect(buildSeguimientoUrl('', 'https://app.test')).toBeNull();
  });

  it('omite costo y notas vacíos', () => {
    const fields = ticketFields({ id: 9, nombre_propietario: 'X' });
    expect(fields.some(f => f.label === 'Costo est.')).toBe(false);
    expect(fields.some(f => f.label === 'Notas')).toBe(false);
    expect(fields.some(f => f.label === 'Cliente' && f.value === 'X')).toBe(true);
  });
});
