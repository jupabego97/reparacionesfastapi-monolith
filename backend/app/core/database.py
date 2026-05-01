import os
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy.pool import StaticPool

from .config import get_settings


def _normalize_database_url(url: str) -> str:
    """Ajustes para proveedores (p. ej. Railway) sin sobrescribir parámetros ya definidos."""
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)

    parsed = urlparse(url)
    if parsed.scheme.startswith("postgresql") and parsed.hostname:
        host = parsed.hostname.lower()
        q = dict(parse_qsl(parsed.query, keep_blank_values=True))
        # Proxy TCP público de Railway (*.proxy.rlwy.net): PostgreSQL espera TLS.
        if host.endswith(".proxy.rlwy.net") and "sslmode" not in q:
            q["sslmode"] = "require"

        merged_query = urlencode(q) if q else ""
        return urlunparse(parsed._replace(query=merged_query))
    return url


def _raise_if_railway_db_points_to_this_service(url: str) -> None:
    """Railway: DATABASE_URL mal referenciado suele apuntar a `web.railway.internal` (esta app), no a Postgres."""
    srv = (os.environ.get("RAILWAY_SERVICE_NAME") or "").strip().lower()
    if not srv or not url.startswith("postgresql"):
        return
    host = (urlparse(url).hostname or "").lower()
    if host == f"{srv}.railway.internal":
        port = urlparse(url).port or 5432
        raise RuntimeError(
            f"DATABASE_URL apunta a {host}:{port}, el host interno de este servicio Railway ({srv!r}), "
            "no del plugin PostgreSQL; en el puerto 5432 no hay base de datos aquí. "
            "En Variables del servicio que corre la API, referenciá DATABASE_URL del servicio Postgres "
            "(Add variable → Reference → tu servicio Postgres), no del servicio web."
        )


def get_database_url() -> str:
    url = _normalize_database_url(get_settings().database_url)
    _raise_if_railway_db_points_to_this_service(url)
    return url


def create_db_engine():
    url = get_database_url()
    if url.startswith("sqlite"):
        return create_engine(
            url,
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
    connect_args = {"connect_timeout": 15}
    return create_engine(
        url,
        pool_size=10,
        pool_recycle=3600,
        pool_pre_ping=True,
        max_overflow=20,
        connect_args=connect_args,
    )


engine = create_db_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
