/** Fechas y horas en zona Colombia (America/Bogota, UTC−5 sin DST). */
export const COLOMBIA_TZ = 'America/Bogota';

/** Fecha calendario de hoy en Colombia (YYYY-MM-DD). */
export function todayColombiaISO(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: COLOMBIA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/** Suma días al calendario dado (interpretación en Colombia para el resultado). */
export function addCalendarDaysColombia(fromYmd: string, delta: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fromYmd.trim().slice(0, 10));
  if (!m) return fromYmd;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const next = new Date(Date.UTC(y, mo - 1, d + delta));
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: COLOMBIA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(next);
}

export function tomorrowColombiaISO(): string {
  return addCalendarDaysColombia(todayColombiaISO(), 1);
}

/** Solo fecha (día/mes/año) para YYYY-MM-DD interpretado como calendario Colombia. */
export function formatYmdColombiaShort(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim().slice(0, 10));
  if (!m) return ymd;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T12:00:00-05:00`);
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: COLOMBIA_TZ,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

/**
 * Interpreta el instante que envía el API: ISO con Z, o legado sin zona
 * (el servidor guardaba UTC como "YYYY-MM-DD HH:mm:ss").
 */
export function parseBackendInstant(raw: string): Date {
  const s = String(raw).trim();
  if (!s) return new Date(NaN);
  if (/[zZ]$|[+-]\d{2}:\d{2}$/.test(s)) {
    return new Date(s);
  }
  const legacySpace = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?)$/.exec(s);
  if (legacySpace) {
    return new Date(`${legacySpace[1]}T${legacySpace[2]}Z`);
  }
  const isoT = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?)$/.exec(s);
  if (isoT) {
    return new Date(`${isoT[1]}T${isoT[2]}Z`);
  }
  return new Date(s);
}

/**
 * Formatea instante ISO del API (UTC) como fecha/hora en Colombia.
 */
export function formatDateTimeColombia(
  raw: string | null | undefined,
  options?: Intl.DateTimeFormatOptions,
): string {
  if (raw == null || String(raw).trim() === '') return '—';
  const d = parseBackendInstant(String(raw));
  if (Number.isNaN(d.getTime())) return String(raw);
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: COLOMBIA_TZ,
    dateStyle: 'short',
    timeStyle: 'short',
    ...options,
  }).format(d);
}
