import { useState, useEffect } from 'react';
import type { UserInfo, Tag } from '../api/client';

interface Filtros {
  search: string;
  estado: string;
  prioridad: string;
  asignado_a: string;
  cargador: string;
  tag: string;
}

interface Props {
  filtros: Filtros;
  onChange: (f: Filtros) => void;
  totalResults?: number;
  users: UserInfo[];
  tags: Tag[];
  columnas: { key: string; title: string }[];
}

function useIsMobileFilters(): boolean {
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 768);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const fn = () => setM(mq.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);
  return m;
}

export default function BusquedaFiltros({ filtros, onChange, totalResults, users, tags, columnas }: Props) {
  const isMobile = useIsMobileFilters();
  const [sheetOpen, setSheetOpen] = useState(false);
  const set = (key: keyof Filtros, val: string) => onChange({ ...filtros, [key]: val });
  const hasFilters = filtros.search || filtros.estado || filtros.prioridad || filtros.asignado_a || filtros.cargador || filtros.tag;
  const activeFilterCount = [filtros.estado, filtros.prioridad, filtros.asignado_a, filtros.cargador, filtros.tag].filter(Boolean).length;

  useEffect(() => {
    const open = () => setSheetOpen(true);
    window.addEventListener('board-open-filters', open);
    return () => window.removeEventListener('board-open-filters', open);
  }, []);

  useEffect(() => {
    if (!isMobile) setSheetOpen(false);
  }, [isMobile]);

  const filterControls = (
    <>
      <select className="filter-select" value={filtros.estado} onChange={e => set('estado', e.target.value)} aria-label="Filtrar por estado">
        <option value="">Todos los estados</option>
        {columnas.map(c => (
          <option key={c.key} value={c.key}>
            {c.title}
          </option>
        ))}
      </select>

      <select className="filter-select" value={filtros.prioridad} onChange={e => set('prioridad', e.target.value)} aria-label="Filtrar por prioridad">
        <option value="">Toda prioridad</option>
        <option value="alta">Alta</option>
        <option value="media">Media</option>
        <option value="baja">Baja</option>
      </select>

      <select className="filter-select" value={filtros.asignado_a} onChange={e => set('asignado_a', e.target.value)} aria-label="Filtrar por tecnico">
        <option value="">Todos los tecnicos</option>
        {users.map(u => (
          <option key={u.id} value={u.id}>
            {u.full_name}
          </option>
        ))}
      </select>

      {tags.length > 0 && (
        <select className="filter-select" value={filtros.tag} onChange={e => set('tag', e.target.value)} aria-label="Filtrar por etiqueta">
          <option value="">Todas las etiquetas</option>
          {tags.map(t => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      )}

      <select className="filter-select" value={filtros.cargador} onChange={e => set('cargador', e.target.value)} aria-label="Filtrar por cargador">
        <option value="">Cargador</option>
        <option value="si">Con cargador</option>
        <option value="no">Sin cargador</option>
      </select>
    </>
  );

  return (
    <div className="filtros-bar">
      <div className="filtros-row">
        <div className="search-box">
          <i className="fas fa-search"></i>
          <input
            id="board-search-input"
            type="text"
            value={filtros.search}
            onChange={e => set('search', e.target.value)}
            placeholder="Buscar por nombre, problema o WhatsApp..."
            aria-label="Buscar tarjetas"
          />
          {filtros.search && (
            <button type="button" className="clear-search" onClick={() => set('search', '')} aria-label="Limpiar busqueda">
              <i className="fas fa-times"></i>
            </button>
          )}
        </div>

        {isMobile && (
          <button type="button" className="filters-sheet-trigger" onClick={() => setSheetOpen(true)} aria-expanded={sheetOpen} aria-controls="filters-sheet-panel">
            <i className="fas fa-sliders-h"></i>
            <span>Filtros</span>
            {activeFilterCount > 0 && <span className="filter-badge">{activeFilterCount}</span>}
          </button>
        )}

        {!isMobile && <div className="filtros-desktop-filters">{filterControls}</div>}
      </div>

      {(hasFilters || totalResults !== undefined) && (
        <div className="filtros-info">
          {totalResults !== undefined && <span className="results-count">{totalResults} resultados</span>}
          {hasFilters && (
            <button
              type="button"
              className="clear-all-btn"
              onClick={() => onChange({ search: '', estado: '', prioridad: '', asignado_a: '', cargador: '', tag: '' })}
            >
              <i className="fas fa-times-circle"></i> Limpiar filtros
            </button>
          )}
        </div>
      )}

      {isMobile && sheetOpen && (
        <div className="filters-sheet-backdrop" role="presentation" onClick={() => setSheetOpen(false)}>
          <div
            id="filters-sheet-panel"
            className="filters-sheet-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="filters-sheet-title"
            onClick={e => e.stopPropagation()}
          >
            <div className="filters-sheet-header">
              <h2 id="filters-sheet-title" className="filters-sheet-title">
                Filtros
              </h2>
              <button type="button" className="filters-sheet-close" onClick={() => setSheetOpen(false)} aria-label="Cerrar filtros">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="filters-sheet-body">{filterControls}</div>
            <div className="filters-sheet-footer">
              <button type="button" className="filters-sheet-done" onClick={() => setSheetOpen(false)}>
                Listo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
