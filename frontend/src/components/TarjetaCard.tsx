import { memo, useCallback, type SyntheticEvent } from 'react';
import type { TarjetaBoardItem, KanbanColumn } from '../api/client';
import { dueDateLabel } from '../utils/dueDateLabel';
import { clientRepairWhatsAppUrl } from '../utils/whatsappUrl';

interface Props {
  tarjeta: TarjetaBoardItem;
  columnas: KanbanColumn[];
  onEdit: (t: TarjetaBoardItem) => void;
  onDelete: (id: number) => void;
  onMove: (id: number, newCol: string) => void;
  compact?: boolean;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (id: number) => void;
  onBlock?: (id: number, reason: string) => void;
  onUnblock?: (id: number) => void;
  dragHandleProps?: Record<string, unknown>;
  isDragging?: boolean;
}

const PRIORITY_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  alta: { icon: 'fas fa-arrow-up', color: '#ef4444', label: 'Alta' },
  media: { icon: 'fas fa-minus', color: '#f59e0b', label: 'Media' },
  baja: { icon: 'fas fa-arrow-down', color: '#22c55e', label: 'Baja' },
};

function timeColor(days: number): string {
  if (days <= 1) return '#22c55e';
  if (days <= 3) return '#f59e0b';
  if (days <= 7) return '#f97316';
  return '#ef4444';
}

function notifyCreadaMeta(status: string | null | undefined): { label: string; className: string } | null {
  if (!status) return null;
  const s = status.toLowerCase();
  if (s === 'sent') return { label: 'WA creada', className: 'notify-pill notify-pill--sent' };
  if (s === 'skipped') return { label: 'WA omitida', className: 'notify-pill notify-pill--skipped' };
  if (s === 'failed') return { label: 'WA error', className: 'notify-pill notify-pill--failed' };
  return null;
}

function TarjetaCardComponent({
  tarjeta,
  columnas,
  onEdit,
  onDelete: _onDelete,
  onMove,
  compact,
  selectable,
  selected,
  onSelect,
  dragHandleProps,
  isDragging,
}: Props) {
  const t = tarjeta;
  const prio = PRIORITY_CONFIG[t.prioridad] || PRIORITY_CONFIG.media;
  const due = dueDateLabel(t.fecha_limite);
  const daysColor = timeColor(t.dias_en_columna || 0);
  const whatsUrl = clientRepairWhatsAppUrl(t.whatsapp, t.nombre_propietario);
  const isBlocked = !!t.bloqueada;
  const notaTecnica = t.notas_tecnicas_resumen || t.notas_tecnicas || '';
  const notifyMeta = notifyCreadaMeta(t.notify_creada_estado);

  const canMove = !isBlocked;
  const colIndex = columnas.findIndex(c => c.key === t.columna);
  const prevCol = canMove && colIndex > 0 ? columnas[colIndex - 1] : null;
  const nextCol = canMove && colIndex < columnas.length - 1 ? columnas[colIndex + 1] : null;

  const openEdit = useCallback(() => onEdit(t), [onEdit, t]);

  const stop = (e: SyntheticEvent) => e.stopPropagation();

  if (compact) {
    const compactThumb = t.cover_thumb_url || t.imagen_url || '';
    return (
      <article
        className={`tarjeta-card compact ${due.severity === 'overdue' ? 'overdue' : ''} ${isBlocked ? 'blocked' : ''} ${isDragging ? 'dragging' : ''}`}
        onClick={openEdit}
        tabIndex={0}
        role="button"
        aria-label={`Reparación #${t.id}, ${t.nombre_propietario || 'Cliente'}`}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openEdit();
          }
        }}
      >
        <div className="tarjeta-compact-row">
          {dragHandleProps && (
            <span
              className="drag-handle-compact"
              {...dragHandleProps}
              onClick={stop}
              onKeyDown={e => e.stopPropagation()}
            >
              <i className="fas fa-grip-vertical"></i>
            </span>
          )}
          {compactThumb && (
            <img
              src={compactThumb}
              alt=""
              className="tarjeta-compact-thumb"
              loading="lazy"
              onClick={e => {
                stop(e);
                window.open(t.imagen_url || t.cover_thumb_url || '', '_blank', 'noopener,noreferrer');
              }}
            />
          )}
          <span className="priority-dot" style={{ background: prio.color }} title={`Prioridad ${prio.label}`} />
          <span className="tarjeta-folio-compact">#{t.id}</span>
          <span className="tarjeta-name">{t.nombre_propietario || 'Cliente'}</span>
          {t.asignado_nombre && (
            <span className="assigned-badge" title={t.asignado_nombre}>
              {t.asignado_nombre[0]}
            </span>
          )}
          <div className="tarjeta-compact-actions">
            {t.fecha_inicio && (
              <span className="tarjeta-fecha-creacion-compact" title={`Creada: ${t.fecha_inicio}`}>
                <i className="fas fa-clock" aria-hidden="true"></i>
              </span>
            )}
            {notifyMeta && (
              <span className={notifyMeta.className} title="Aviso WhatsApp al crear tarjeta">
                {notifyMeta.label}
              </span>
            )}
            {t.tags?.length > 0 && (
              <span className="tag-count">
                {t.tags.length} <i className="fas fa-tags"></i>
              </span>
            )}
            {whatsUrl && (
              <a
                href={whatsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-wa-sm"
                onClick={stop}
                title="WhatsApp"
                aria-label="Abrir WhatsApp con el cliente"
              >
                <i className="fab fa-whatsapp"></i>
              </a>
            )}
            <div className="tarjeta-compact-arrows">
              {prevCol && (
                <button
                  type="button"
                  className="btn-action btn-col-arrow btn-col-arrow-sm"
                  onClick={e => {
                    stop(e);
                    onMove(t.id, prevCol.key);
                  }}
                  title={`Mover a ${prevCol.title}`}
                  aria-label={`Mover a ${prevCol.title}`}
                  style={{ borderColor: prevCol.color, color: prevCol.color }}
                >
                  <i className="fas fa-chevron-left"></i>
                </button>
              )}
              {nextCol && (
                <button
                  type="button"
                  className="btn-action btn-col-arrow btn-col-arrow-sm"
                  onClick={e => {
                    stop(e);
                    onMove(t.id, nextCol.key);
                  }}
                  title={`Mover a ${nextCol.title}`}
                  aria-label={`Mover a ${nextCol.title}`}
                  style={{ borderColor: nextCol.color, color: nextCol.color }}
                >
                  <i className="fas fa-chevron-right"></i>
                </button>
              )}
            </div>
          </div>
        </div>
      </article>
    );
  }

  const dueClass =
    due.severity === 'overdue'
      ? 'tarjeta-due-label--overdue'
      : due.severity === 'today' || due.severity === 'tomorrow'
        ? 'tarjeta-due-label--urgent'
        : due.severity === 'soon'
          ? 'tarjeta-due-label--soon'
          : 'tarjeta-due-label--ok';

  return (
    <article
      className={`tarjeta-card tarjeta-card-pro ${due.severity === 'overdue' ? 'overdue' : ''} ${isBlocked ? 'blocked' : ''} ${selected ? 'card-selected' : ''} ${isDragging ? 'dragging' : ''}`}
      tabIndex={0}
      role="button"
      aria-pressed={selectable ? selected : undefined}
      aria-label={`Reparación número ${t.id}, ${t.nombre_propietario || 'Cliente'}. ${due.text}.`}
      onClick={openEdit}
      onKeyDown={e => {
        if (e.key === 'Enter' || (e.key === ' ' && !selectable)) {
          e.preventDefault();
          openEdit();
        }
        if (e.key === ' ' && selectable) {
          e.preventDefault();
          onSelect?.(t.id);
        }
      }}
    >
      <div className="priority-strip" style={{ background: isBlocked ? '#ef4444' : prio.color }} />

      {dragHandleProps && (
        <div
          className="drag-handle"
          {...dragHandleProps}
          aria-label="Arrastrar tarjeta"
          onClick={stop}
        >
          <i className="fas fa-grip-vertical"></i>
        </div>
      )}

      {selectable && (
        <div
          className="card-checkbox"
          role="checkbox"
          aria-checked={selected}
          tabIndex={-1}
          onClick={e => {
            stop(e);
            onSelect?.(t.id);
          }}
        >
          <i className={selected ? 'fas fa-check-square' : 'far fa-square'}></i>
        </div>
      )}

      {isBlocked && (
        <div className="blocked-banner">
          <i className="fas fa-lock"></i> Bloqueada{t.motivo_bloqueo ? `: ${t.motivo_bloqueo}` : ''}
        </div>
      )}

      <header className="tarjeta-header-pro">
        <div className="tarjeta-header-top">
          <span className="tarjeta-folio" title="Folio">
            #{t.id}
          </span>
          {notifyMeta && (
            <span className={notifyMeta.className} title="Estado del aviso automático al crear la tarjeta">
              {notifyMeta.label}
            </span>
          )}
        </div>
        <div className="tarjeta-title-block">
          <i className={prio.icon} style={{ color: prio.color }} title={`Prioridad ${prio.label}`} />
          <strong className="tarjeta-name-pro">{t.nombre_propietario || 'Cliente'}</strong>
        </div>
        <div className="tarjeta-meta">
          {t.asignado_nombre && (
            <span className="assigned-badge" title={`Asignado: ${t.asignado_nombre}`} style={{ background: '#6366f1' }}>
              {t.asignado_nombre
                .split(' ')
                .map(w => w[0])
                .join('')
                .slice(0, 2)}
            </span>
          )}
        </div>
      </header>

      <div className="tarjeta-signals" onClick={stop}>
        {t.fecha_inicio && (
          <span className="tarjeta-created-at" title="Fecha y hora exacta de creación (registro del sistema)">
            <i className="fas fa-plus-circle" aria-hidden="true"></i>
            <span className="tarjeta-created-at-label">Creada</span>
            <code className="tarjeta-created-at-value">{t.fecha_inicio}</code>
          </span>
        )}
        <span className={`tarjeta-due-label ${dueClass}`} title={due.iso ? `Fecha límite: ${due.iso}` : undefined}>
          <i className="fas fa-calendar-alt" aria-hidden="true"></i> {due.text}
        </span>
        {t.dias_en_columna > 0 && (
          <span className="days-badge" style={{ color: daysColor }} title={`${t.dias_en_columna} días en esta columna`}>
            <i className="fas fa-clock"></i> {t.dias_en_columna}d
          </span>
        )}
      </div>

      {(() => {
        const raw = (t.problema_resumen || t.problema || '').trim();
        if (!raw || /^Sin descripci[oó]n$/i.test(raw)) return null;
        return (
          <p className="tarjeta-problem-pro" aria-label="Problema reportado">
            {t.problema_resumen || (t.problema!.length > 100 ? `${t.problema!.slice(0, 100)}…` : t.problema)}
          </p>
        );
      })()}

      {notaTecnica && (
        <div className="tarjeta-notas-tecnicas" aria-label="Notas técnicas" onClick={stop}>
          <i className="fas fa-wrench"></i>
          <span>{notaTecnica}</span>
        </div>
      )}

      {t.tags && t.tags.length > 0 && (
        <div className="tarjeta-tags" onClick={stop}>
          {t.tags.map(tag => (
            <span
              key={tag.id}
              className="tag-chip"
              style={{ background: `${tag.color}22`, color: tag.color, borderColor: `${tag.color}44` }}
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}

      {t.subtasks_total > 0 && (
        <div className="subtasks-progress" onClick={stop}>
          <div className="subtasks-bar">
            <div className="subtasks-fill" style={{ width: `${(t.subtasks_done / t.subtasks_total) * 100}%` }}></div>
          </div>
          <span className="subtasks-text">
            {t.subtasks_done}/{t.subtasks_total}
          </span>
        </div>
      )}

      {(t.cover_thumb_url || t.imagen_url) && (
        <img
          src={t.cover_thumb_url || t.imagen_url || ''}
          alt="Foto del equipo"
          className="tarjeta-thumbnail"
          loading="lazy"
          onClick={e => {
            stop(e);
            window.open(t.imagen_url || t.cover_thumb_url || '', '_blank', 'noopener,noreferrer');
          }}
        />
      )}

      {(prevCol || nextCol) && (
        <div className="tarjeta-col-arrows-overlay" onClick={stop}>
          {prevCol && (
            <button
              type="button"
              className="btn-col-arrow-overlay"
              onClick={() => onMove(t.id, prevCol.key)}
              title={`← ${prevCol.title}`}
              aria-label={`Mover a ${prevCol.title}`}
              style={{ '--arrow-color': prevCol.color } as React.CSSProperties}
            >
              <i className="fas fa-chevron-left"></i>
            </button>
          )}
          {nextCol && (
            <button
              type="button"
              className="btn-col-arrow-overlay"
              onClick={() => onMove(t.id, nextCol.key)}
              title={`${nextCol.title} →`}
              aria-label={`Mover a ${nextCol.title}`}
              style={{ '--arrow-color': nextCol.color } as React.CSSProperties}
            >
              <i className="fas fa-chevron-right"></i>
            </button>
          )}
        </div>
      )}

      <footer className="tarjeta-footer tarjeta-footer-pro" onClick={stop}>
        <div className="tarjeta-footer-left">
          {t.tiene_cargador === 'si' && (
            <span className="charger-badge" title="Con cargador">
              <i className="fas fa-plug"></i>
            </span>
          )}
          {t.comments_count > 0 && (
            <span className="comments-badge">
              <i className="fas fa-comment"></i> {t.comments_count}
            </span>
          )}
          {t.costo_estimado != null && (
            <span className="cost-badge" title={`Estimado: $${t.costo_estimado.toLocaleString()}`}>
              <i className="fas fa-dollar-sign"></i>
            </span>
          )}
        </div>
        <div className="tarjeta-footer-right">
          {whatsUrl && (
            <a
              href={whatsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-wa-icon"
              title="WhatsApp al cliente"
              aria-label="Abrir WhatsApp con mensaje para el cliente"
              onClick={stop}
            >
              <i className="fab fa-whatsapp"></i>
            </a>
          )}
          <button
            type="button"
            className="btn-action btn-edit"
            onClick={e => {
              stop(e);
              openEdit();
            }}
            title="Abrir detalle"
            aria-label="Abrir detalle de la tarjeta"
          >
            <i className="fas fa-pen"></i>
          </button>
        </div>
      </footer>
    </article>
  );
}

const TarjetaCard = memo(TarjetaCardComponent);
export default TarjetaCard;
