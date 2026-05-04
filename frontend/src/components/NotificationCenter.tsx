import { useState, useCallback, type KeyboardEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { NotificationItem } from '../api/client';
import { formatDateTimeColombia } from '../utils/colombiaTime';

function NotifRow({
  n,
  typeIcons,
  typeColors,
  onActivate,
}: {
  n: NotificationItem;
  typeIcons: Record<string, string>;
  typeColors: Record<string, string>;
  onActivate: () => void;
}) {
  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onActivate();
      }
    },
    [onActivate],
  );
  return (
    <div
      role="button"
      tabIndex={0}
      className={`notification-item ${n.read ? 'read' : 'unread'}`}
      onClick={onActivate}
      onKeyDown={onKeyDown}
      aria-label={n.read ? n.title : `${n.title}. No leída. Pulse para marcar como leída.`}
    >
      <i className={typeIcons[n.type] || 'fas fa-info-circle'} style={{ color: typeColors[n.type] }} aria-hidden="true"></i>
      <div className="notif-content">
        <strong>{n.title}</strong>
        <p>{n.message}</p>
        <small>{n.created_at ? formatDateTimeColombia(n.created_at) : ''}</small>
      </div>
    </div>
  );
}

export default function NotificationCenter() {
    const qc = useQueryClient();
    const [open, setOpen] = useState(false);

    const { data } = useQuery({
        queryKey: ['notificaciones'],
        queryFn: () => api.getNotificaciones(),
        refetchInterval: 60_000, // 60s — socket events trigger invalidation for real-time
        staleTime: 30_000,
    });

    const markAllMut = useMutation({
        mutationFn: () => api.markAllNotificationsRead(),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['notificaciones'] }),
    });

    const markReadMut = useMutation({
        mutationFn: (ids: number[]) => api.markNotificationsRead(ids),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['notificaciones'] }),
    });

    const unreadCount = data?.unread_count || 0;
    const notifications = data?.notifications || [];

    const typeIcons: Record<string, string> = {
        info: 'fas fa-info-circle',
        success: 'fas fa-check-circle',
        warning: 'fas fa-exclamation-triangle',
        error: 'fas fa-times-circle',
    };
    const typeColors: Record<string, string> = {
        info: '#3b82f6',
        success: '#22c55e',
        warning: '#f59e0b',
        error: '#ef4444',
    };

    return (
        <div className="notification-center">
            <button
                className="notification-bell"
                onClick={() => setOpen(!open)}
                aria-label="Abrir notificaciones"
                aria-haspopup="dialog"
                aria-expanded={open}
            >
                <i className="fas fa-bell"></i>
                {unreadCount > 0 && <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
            </button>

            {open && (
                <>
                    <div className="notification-overlay" onClick={() => setOpen(false)} />
                    <div className="notification-panel" role="dialog" aria-label="Centro de notificaciones">
                        <div className="notification-panel-header">
                            <h4><i className="fas fa-bell"></i> Notificaciones</h4>
                            {unreadCount > 0 && (
                                <button className="mark-all-btn" onClick={() => markAllMut.mutate()}>
                                    <i className="fas fa-check-double"></i> Marcar todas
                                </button>
                            )}
                        </div>
                        <div className="notification-list">
                            {notifications.length === 0 ? (
                                <p className="empty-notif"><i className="fas fa-bell-slash"></i> Sin notificaciones</p>
                            ) : (
                                notifications.map((n: NotificationItem) => (
                                    <NotifRow
                                      key={n.id}
                                      n={n}
                                      typeIcons={typeIcons}
                                      typeColors={typeColors}
                                      onActivate={() => !n.read && markReadMut.mutate([n.id])}
                                    />
                                ))
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
