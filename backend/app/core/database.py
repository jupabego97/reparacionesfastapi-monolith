import os
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

from sqlalchemy import create_engine
from sqlalchemy.engine.url import URL, make_url
from sqlalchemy.exc import ArgumentError as SAArgumentError
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy.pool import StaticPool

from .config import get_settings


def _repair_host_segment_optional_port(seg: str) -> str:
    """
    Plantillas tipo `${HOST}:${PGPORT}` con PGPORT vacío suelen producir:

    `host:/db`, `host::/db` o varios ':' finales. SQLAlchemy acaba viendo puerto ''

    ante `:/` pero también falla ante `host::` porque el último sufijo `: ` no viene vacío.
    Quitar sólo ':' al final preserva puertos válidos (`...:5432` termina en dígito, no ':').
    """
    return seg.rstrip(":")


def _repair_postgresql_netloc(netloc: str) -> str:
    if not netloc:
        return netloc
    if "@" in netloc:
        userpart, hp = netloc.rsplit("@", 1)
        return userpart + "@" + _repair_host_segment_optional_port(hp)
    return _repair_host_segment_optional_port(netloc)


def _normalize_database_url(url: str) -> str:
    """Ajustes para proveedores (p. ej. Railway) sin sobrescribir parámetros ya definidos."""
    url = (url or "").strip()

    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)

    parsed = urlparse(url)
    if not parsed.scheme.startswith("postgresql"):
        return url

    if parsed.netloc:
        repaired = _repair_postgresql_netloc(parsed.netloc.strip())
        parsed = parsed._replace(netloc=repaired)

    host = (parsed.hostname or "").lower()
    q = dict(parse_qsl(parsed.query, keep_blank_values=True))
    if host.endswith(".proxy.rlwy.net") and "sslmode" not in q:
        q["sslmode"] = "require"

    merged_query = urlencode(q) if q else ""
    return urlunparse(parsed._replace(query=merged_query))


def _infer_railway_postgres_database(hostname: str | None, path: str) -> str:
    current = path.lstrip("/") if path else ""
    if current:
        return current
    h = (hostname or "").lower()
    if ".railway.internal" in h or ".proxy.rlwy.net" in h:
        return "railway"
    return current


def _ensure_railway_default_database(url: str) -> str:
    """Plantillas que omiten /PGDATABASE dejan database=None para hosts Railway; Postgres usa otro BD por defecto."""
    p = urlparse(url.strip())
    if not p.scheme.startswith("postgresql") or not p.hostname:
        return url
    if (p.path or "").strip("/"):
        return url
    h = p.hostname.lower()
    if ".railway.internal" not in h and ".proxy.rlwy.net" not in h:
        return url
    return urlunparse(p._replace(path="/railway"))


def _rescue_postgresql_url(url: str) -> str:
    """Ensambla una URL válida cuando make_url rechaza cadenas raras típicas de plantillas Railway."""
    p_in = urlparse(url.strip())
    if not p_in.scheme.startswith("postgresql"):
        return url

    netloc_fixed = (
        _repair_postgresql_netloc(p_in.netloc.strip())
        if p_in.netloc
        else ""
    )
    rebuilt = urlunparse(
        (
            p_in.scheme,
            netloc_fixed,
            p_in.path or "",
            p_in.params,
            p_in.query,
            p_in.fragment,
        )
    )

    parsed = urlparse(rebuilt)

    hostname = parsed.hostname
    if not (hostname or "").strip():
        raise RuntimeError(
            "DATABASE_URL de PostgreSQL no incluye servidor (hostname). "
            "En Railway: Reference → Postgres → DATABASE_URL (no perdá el fragmento "
            "`@HOST...` al armar variables)."
        )

    username = parsed.username

    password = parsed.password

    try:
        port = parsed.port
    except ValueError:
        port = None

    q = dict(parse_qsl(parsed.query, keep_blank_values=True))
    q = {k: v for k, v in q.items() if v != ""}
    hlow = (hostname or "").lower()
    if hlow.endswith(".proxy.rlwy.net") and "sslmode" not in q:
        q["sslmode"] = "require"

    database = _infer_railway_postgres_database(hostname, parsed.path or "")

    try:
        u = URL.create(
            drivername="postgresql",
            username=username,
            password=password,
            host=hostname,
            port=port,
            database=database or None,
            query=q,
        )
        canonical = u.render_as_string(hide_password=False)
        make_url(canonical)
        return canonical
    except Exception as inner:
        hint = ""
        try:
            hint = f" hostname={parsed.hostname!r} path_db={parsed.path!r}"
        except Exception:
            pass
        raise RuntimeError(
            "No se pudo interpretar DATABASE_URL como PostgreSQL. "
            + hint
            + " En Railway usá “Reference → servicio Postgres → DATABASE_URL” sin plantillas "
            "manuales con ${DOMAIN}:${PGPORT} si pueden quedar vacías."
        ) from inner


def _reject_postgresql_missing_host(canonical_url: str) -> None:
    """libpq/psycopg2 sin host en el DSN usan socket Unix local (/var/run/postgresql), inútil en contenedores."""
    p = urlparse(canonical_url.strip())
    if not p.scheme.startswith("postgresql"):
        return
    if p.hostname:
        return
    raise RuntimeError(
        "DATABASE_URL de PostgreSQL no incluye servidor (falta @HOST antes del nombre de la base). "
        "Ejemplo correcto: postgresql://USUARIO:CLAVE@HOST:PUERTO/railway. "
        "En Railway creá la variable DATABASE_URL como Reference → servicio Postgres → DATABASE_URL, "
        "no una plantilla donde desaparezca el host por variables vacías."
    )


def _postgres_url_from_pg_env() -> str | None:
    """Reconstruye DATABASE_URL desde variables PG* si Railway las expone por referencia."""
    host = (
        os.environ.get("PGHOST")
        or os.environ.get("POSTGRES_HOST")
        or os.environ.get("DATABASE_HOST")
        or ""
    ).strip()
    if not host:
        return None

    user = (os.environ.get("PGUSER") or os.environ.get("POSTGRES_USER") or "postgres").strip()
    password = (os.environ.get("PGPASSWORD") or os.environ.get("POSTGRES_PASSWORD") or "").strip()
    database = (os.environ.get("PGDATABASE") or os.environ.get("POSTGRES_DB") or "railway").strip()
    port_raw = (
        os.environ.get("PGPORT")
        or os.environ.get("POSTGRES_PORT")
        or os.environ.get("RAILWAY_TCP_PROXY_PORT")
        or ""
    ).strip()
    try:
        port = int(port_raw) if port_raw else None
    except ValueError:
        port = None

    hlow = host.lower()
    query = {"sslmode": "require"} if hlow.endswith(".proxy.rlwy.net") else {}
    u = URL.create(
        drivername="postgresql",
        username=user or None,
        password=password or None,
        host=host,
        port=port,
        database=database or "railway",
        query=query,
    )
    return u.render_as_string(hide_password=False)


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
    raw = _normalize_database_url(get_settings().database_url)
    _raise_if_railway_db_points_to_this_service(raw)
    pg_env_url = _postgres_url_from_pg_env()

    if not raw.startswith("postgresql"):
        return raw

    try:
        make_url(raw)
        coerced = _ensure_railway_default_database(raw)
        make_url(coerced)
        _reject_postgresql_missing_host(coerced)
        return coerced
    except (ValueError, SAArgumentError, RuntimeError):
        if pg_env_url:
            make_url(pg_env_url)
            _reject_postgresql_missing_host(pg_env_url)
            return pg_env_url
        rescued = _rescue_postgresql_url(raw)
        coerced = _ensure_railway_default_database(rescued)
        make_url(coerced)
        _reject_postgresql_missing_host(coerced)
        return coerced


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
