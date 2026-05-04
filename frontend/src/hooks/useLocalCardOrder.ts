import { useCallback } from 'react';
import type { TarjetaBoardItem } from '../api/client';

const PREFIX = 'kanban-card-order';

function storageKey(userId: number, columnKey: string): string {
  return `${PREFIX}:${userId}:${columnKey}`;
}

/** Aplica orden guardado en localStorage para una columna; si no hay, orden por posición del servidor. */
export function applyLocalColumnOrder(
  userId: number | null | undefined,
  columnKey: string,
  cards: TarjetaBoardItem[],
): TarjetaBoardItem[] {
  if (userId == null) {
    return [...cards].sort((a, b) => a.posicion - b.posicion);
  }
  let order: number[] | null = null;
  try {
    const raw = localStorage.getItem(storageKey(userId, columnKey));
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) order = parsed.map(Number).filter(n => !Number.isNaN(n));
    }
  } catch {
    order = null;
  }
  if (!order?.length) {
    return [...cards].sort((a, b) => a.posicion - b.posicion);
  }
  const inCol = cards.filter(c => c.columna === columnKey);
  const byId = new Map(inCol.map(c => [c.id, c]));
  const out: TarjetaBoardItem[] = [];
  const used = new Set<number>();
  for (const id of order) {
    const c = byId.get(id);
    if (c) {
      out.push(c);
      used.add(id);
    }
  }
  for (const c of inCol.sort((a, b) => a.posicion - b.posicion)) {
    if (!used.has(c.id)) out.push(c);
  }
  return out;
}

type ReorderItem = { id: number; columna: string; posicion: number };

/** Reconstruye tarjetas agrupadas por columna tras un reorder (misma lógica que KanbanBoard). */
export function buildGroupedAfterReorder(
  previous: Record<string, TarjetaBoardItem[]>,
  updates: ReorderItem[],
): Record<string, TarjetaBoardItem[]> {
  const byId = new Map<number, TarjetaBoardItem>();
  for (const col of Object.keys(previous)) {
    for (const c of previous[col]) {
      byId.set(c.id, { ...c });
    }
  }
  for (const u of updates) {
    const card = byId.get(u.id);
    if (card) {
      byId.set(u.id, { ...card, columna: u.columna, posicion: u.posicion });
    }
  }
  const grouped: Record<string, TarjetaBoardItem[]> = {};
  for (const col of Object.keys(previous)) {
    grouped[col] = [];
  }
  for (const c of byId.values()) {
    if (grouped[c.columna]) grouped[c.columna].push(c);
  }
  for (const col of Object.keys(grouped)) {
    grouped[col].sort((a, b) => a.posicion - b.posicion);
  }
  return grouped;
}

export function persistLocalOrdersFromReorder(
  userId: number,
  columnKeys: string[],
  previousGrouped: Record<string, TarjetaBoardItem[]>,
  updates: ReorderItem[],
): void {
  const grouped = buildGroupedAfterReorder(previousGrouped, updates);
  for (const col of columnKeys) {
    const ids = (grouped[col] || []).map(t => t.id);
    try {
      localStorage.setItem(storageKey(userId, col), JSON.stringify(ids));
    } catch {
      /* quota / privado */
    }
  }
}

export function useLocalCardOrderPersistence(userId: number | null | undefined) {
  const persistFromReorder = useCallback(
    (columnKeys: string[], previousGrouped: Record<string, TarjetaBoardItem[]>, updates: ReorderItem[]) => {
      if (userId == null) return;
      persistLocalOrdersFromReorder(userId, columnKeys, previousGrouped, updates);
    },
    [userId],
  );

  return { persistFromReorder };
}
