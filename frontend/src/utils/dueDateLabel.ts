/** Etiqueta operativa para fecha límite (solo fecha local YYYY-MM-DD). */

export type DueSeverity = 'none' | 'ok' | 'soon' | 'today' | 'tomorrow' | 'overdue';

function startOfLocalDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function parseFechaLimite(raw: string | null | undefined): Date | null {
  if (!raw || !String(raw).trim()) return null;
  const s = String(raw).trim().slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const da = Number(m[3]);
  const dt = new Date(y, mo, da);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

export function dueDateLabel(fechaLimite: string | null | undefined): {
  text: string;
  severity: DueSeverity;
  iso: string | null;
} {
  const dt = parseFechaLimite(fechaLimite);
  if (!dt) {
    return { text: 'Sin fecha límite', severity: 'none', iso: null };
  }
  const iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  const today = startOfLocalDay(new Date());
  const due = startOfLocalDay(dt);
  const diffDays = Math.round((due - today) / (24 * 60 * 60 * 1000));

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
    text: dt.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }),
    severity: 'ok',
    iso,
  };
}
