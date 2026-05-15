import { useEffect, useState } from 'react';
import { API_BASE } from '../api/client';

export type SeguimientoPublico = {
  folio: number;
  nombre_propietario: string;
  estado: string;
  estado_key: string;
  problema: string;
  fecha_inicio: string | null;
  fecha_limite: string | null;
  tiene_cargador: string | null;
  fotos: { url: string; thumb_url: string; position: number }[];
  fotos_count: number;
};

function formatFechaCO(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(d);
}

export default function SeguimientoPage({ token }: { token: string }) {
  const [data, setData] = useState<SeguimientoPublico | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    fetch(`${API_BASE}/api/public/seguimiento/${encodeURIComponent(token)}`)
      .then(async res => {
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error((j as { message?: string }).message || 'No se encontró esta reparación');
        }
        return res.json() as Promise<SeguimientoPublico>;
      })
      .then(d => {
        if (!cancelled) setData(d);
      })
      .catch(e => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Error al cargar');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loading) {
    return (
      <div className="seguimiento-page">
        <div className="seguimiento-card">
          <div className="app-loading" style={{ minHeight: '40vh' }}>
            <div className="spinner-large" />
            <p>Cargando…</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="seguimiento-page">
        <div className="seguimiento-card seguimiento-card--error">
          <i className="fas fa-exclamation-circle" aria-hidden="true" />
          <h1>Enlace no disponible</h1>
          <p>{error || 'Reparación no encontrada'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="seguimiento-page">
      <header className="seguimiento-header">
        <h1>
          <i className="fas fa-tools" aria-hidden="true" /> Nanotronics
        </h1>
        <p className="seguimiento-sub">Seguimiento de su equipo en reparación</p>
      </header>

      <main className="seguimiento-card">
        <div className="seguimiento-folio">Folio #{data.folio}</div>
        <h2 className="seguimiento-name">{data.nombre_propietario}</h2>
        <span className="seguimiento-estado">{data.estado}</span>

        <section className="seguimiento-block">
          <h3>Problema reportado</h3>
          <p>{data.problema}</p>
        </section>

        <section className="seguimiento-meta">
          <div>
            <span className="label">Recibido</span>
            <span>{formatFechaCO(data.fecha_inicio)}</span>
          </div>
          {data.fecha_limite && (
            <div>
              <span className="label">Fecha límite</span>
              <span>{data.fecha_limite}</span>
            </div>
          )}
          {data.tiene_cargador && (
            <div>
              <span className="label">Cargador</span>
              <span>{data.tiene_cargador === 'si' ? 'Sí' : 'No'}</span>
            </div>
          )}
        </section>

        <section className="seguimiento-block">
          <h3>
            <i className="fas fa-images" aria-hidden="true" /> Fotos del equipo ({data.fotos_count})
          </h3>
          {data.fotos_count === 0 ? (
            <p className="seguimiento-empty-fotos">Aún no hay fotos registradas para esta reparación.</p>
          ) : (
            <div className="seguimiento-gallery">
              {data.fotos.map((f, i) => (
                <a
                  key={`${f.url}-${i}`}
                  href={f.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="seguimiento-photo"
                >
                  <img src={f.thumb_url || f.url} alt={`Foto ${i + 1}`} loading="lazy" />
                </a>
              ))}
            </div>
          )}
        </section>
      </main>

      <footer className="seguimiento-footer">
        <p>Gracias por confiar en nosotros. Le avisaremos por WhatsApp cuando haya novedades.</p>
      </footer>
    </div>
  );
}
