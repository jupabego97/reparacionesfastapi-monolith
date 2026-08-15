from urllib.parse import parse_qs

import socketio
from loguru import logger

from app.core.config import get_settings
from app.core.database import SessionLocal
from app.services.auth_service import get_user_from_token_string

settings = get_settings()
transports = ["polling"] if settings.socketio_safe_mode else ["websocket", "polling"]
origins, origin_regex = settings.get_cors_origins()
# Socket.IO no soporta regex; usa lista explícita o "*"
cors_sio: list[str] | str
if origin_regex:
    logger.info(f"CORS fallback: regex {origin_regex} (Socket.IO requerirá ALLOWED_ORIGINS explícito)")
    cors_sio = "*"  # No funciona con credenciales; ALLOWED_ORIGINS recomendado para Socket.IO
else:
    cors_sio = origins
sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=cors_sio,
    logger=not settings.is_production,
    engineio_logger=not settings.is_production,
    ping_timeout=60,
    ping_interval=25,
    max_http_buffer_size=1_000_000,
    allow_upgrades=not settings.socketio_safe_mode,
    transports=transports,
)


def _token_from_connect(environ: dict, auth: object | None) -> str | None:
    if isinstance(auth, dict):
        raw = auth.get("token") or auth.get("access_token")
        if raw:
            return str(raw)
    qs = parse_qs(environ.get("QUERY_STRING") or "")
    if qs.get("token"):
        return qs["token"][0]
    header = environ.get("HTTP_AUTHORIZATION") or ""
    if header.lower().startswith("bearer "):
        return header.split(" ", 1)[1].strip()
    return None


@sio.on("connect")
async def connect(sid, environ, auth=None):
    token = _token_from_connect(environ, auth)
    db = SessionLocal()
    try:
        user = get_user_from_token_string(token or "", db)
        if not user:
            logger.warning("Socket rechazado (sin JWT válido): {}", sid)
            return False
        await sio.save_session(sid, {"user_id": user.id, "role": user.role})
    finally:
        db.close()
    logger.info("Cliente conectado: {} user={}", sid, user.id)
    await sio.emit("status", {"message": "Conectado al servidor en tiempo real"}, to=sid)


@sio.on("disconnect")
async def disconnect(sid):
    logger.info(f"Cliente desconectado: {sid}")


@sio.on("join")
async def join(sid, data=None):
    session = await sio.get_session(sid)
    if not session or not session.get("user_id"):
        return False
    logger.info("Cliente se unió: {}", sid)
    await sio.emit("status", {"message": "Unido al canal de sincronización"}, to=sid)
