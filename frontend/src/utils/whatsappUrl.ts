/** Normaliza número para WhatsApp. Colombia (+57): si son 10 dígitos, antepone 57. */
export function toWhatsAppNumber(raw: string | null | undefined): string {
  if (!raw) return ''
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10 && digits.startsWith('3')) {
    return '57' + digits
  }
  if (digits.startsWith('57') && digits.length >= 12) return digits
  if (digits.length >= 10) return digits
  return ''
}

export function toWhatsAppUrl(raw: string | null | undefined): string | null {
  const num = toWhatsAppNumber(raw)
  return num ? `https://wa.me/${num}` : null
}

/** wa.me con mensaje prellenado (normaliza CO igual que toWhatsAppNumber). */
export function clientRepairWhatsAppUrl(
  raw: string | null | undefined,
  nombreCliente: string | null | undefined,
): string | null {
  const num = toWhatsAppNumber(raw)
  if (!num) return null
  const text = `Hola ${nombreCliente || ''}, le escribimos de Nanotronics respecto a su equipo en reparacion.`.trim()
  return `https://wa.me/${num}?text=${encodeURIComponent(text)}`
}

const MAX_PROBLEMA_BODY = 500

function truncateProblemaForBody(prob: string): string {
  const p = prob.trim() || 'Sin descripción'
  if (p.length > MAX_PROBLEMA_BODY) return p.slice(0, 497) + '...'
  return p
}

/** Mismo texto que `build_tarjeta_created_body` en el backend (sin Cloud API). */
export function buildTarjetaCreatedMessage(
  nombre: string | null | undefined,
  id: number | string,
  problema: string | null | undefined,
): string {
  const nombreVal = ((nombre || 'Cliente').trim() || 'Cliente')
  const prob = truncateProblemaForBody((problema || 'Sin descripción').trim() || 'Sin descripción')
  const tid = id ?? '?'
  return (
    `Hola ${nombreVal}, registramos tu equipo para reparación.\n` +
    `Folio: #${tid}\n` +
    `Motivo: ${prob}\n` +
    'Te avisaremos por este canal cuando haya novedades.'
  )
}

/** wa.me con mensaje de alta de reparación (solo cliente, sin Meta). */
export function newTarjetaCreatedWhatsAppUrl(
  rawPhone: string | null | undefined,
  nombre: string | null | undefined,
  id: number | string,
  problema: string | null | undefined,
): string | null {
  const num = toWhatsAppNumber(rawPhone)
  if (!num) return null
  const text = buildTarjetaCreatedMessage(nombre, id, problema)
  return `https://wa.me/${num}?text=${encodeURIComponent(text)}`
}
