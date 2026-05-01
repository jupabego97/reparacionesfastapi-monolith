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


def get_database_url() -> str:
    url = _normalize_database_url(get_settings().database_url)
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
