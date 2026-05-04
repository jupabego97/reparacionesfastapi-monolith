/** Etiqueta operativa para fecha límite (calendario Colombia, misma zona que registros). */
import { formatYmdColombiaShort, todayColombiaISO } from './colombiaTime';

export type DueSeverity = 'none' | 'ok' | 'soon' | 'today' | 'tomorrow' | 'overdue';

function parseFechaLimiteISO(raw: string | null | undefined): string | null {
  if (!raw || !String(raw).trim()) return null;
  const s = String(raw).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s;
}

/** Días desde `fromYmd` hasta `toYmd` (solo calendario, ordenados como ISO). */
function calendarDiffDays(fromYmd: string, toYmd: string): number {
  const a = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fromYmd);
  const b = /^(\d{4})-(\d{2})-(\d{2})$/.exec(toYmd);
  if (!a || !b) return 0;
  const t0 = Date.UTC(Number(a[1]), Number(a[2]) - 1, Number(a[3]));
  const t1 = Date.UTC(Number(b[1]), Number(b[2]) - 1, Number(b[3]));
  return Math.round((t1 - t0) / 86400000);
}

export function dueDateLabel(fechaLimite: string | null | undefined): {
  text: string;
  severity: DueSeverity;
  iso: string | null;
} {
  const iso = parseFechaLimiteISO(fechaLimite);
  if (!iso) {
    return { text: 'Sin fecha límite', severity: 'none', iso: null };
  }
  const today = todayColombiaISO();
  const diffDays = calendarDiffDays(today, iso);

  if (diffDays < 0) {
    const n = Math.abs(diffDays);
    return {
      text: n === 1 ? 'Vencida ayer' : `Vencida hace ${n} días`,
      severity: 'overdue',
      iso,
    };
  }
  if (diffDays === 0) return { text: 'Vence hoy', severity: 'today', iso };
  if (diffDays === 1) return { text: 'Vence mañana', severity: 'tomorrow', iso };
  if (diffDays <= 3) return { text: `Vence en ${diffDays} días`, severity: 'soon', iso };
  return {
    text: formatYmdColombiaShort(iso),
    severity: 'ok',
    iso,
  };
}
