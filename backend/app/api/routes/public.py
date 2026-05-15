"""Endpoints públicos (sin JWT) para seguimiento del cliente."""

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.core.datetime_fmt import utc_iso_z
from app.core.limiter import limiter
from app.models.repair_card import RepairCard, RepairCardMedia
from app.services.tracking_service import public_status_label, summarize_problem

router = APIRouter(prefix="/api/public", tags=["public"])


def _resolve_media_url(raw_url: str | None, storage_key: str | None) -> str | None:
    if not raw_url and not storage_key:
        return None
    settings = get_settings()
    public_base = (settings.s3_public_base_url or "").rstrip("/")
    if storage_key and public_base:
        return f"{public_base}/{storage_key.lstrip('/')}"
    return raw_url


@router.get("/seguimiento/{token}")
@limiter.limit("60 per minute")
def get_seguimiento_publico(
    request: Request,
    token: str,
    db: Session = Depends(get_db),
):
    """Vista pública: folio, estado y fotos del equipo (token no adivinable)."""
    tok = (token or "").strip()
    if len(tok) < 16:
        raise HTTPException(status_code=404, detail="Enlace no válido")

    t = (
        db.query(RepairCard)
        .filter(RepairCard.tracking_token == tok, RepairCard.deleted_at.is_(None))
        .first()
    )
    if not t:
        raise HTTPException(status_code=404, detail="Reparación no encontrada")

    media_rows = (
        db.query(RepairCardMedia)
        .filter(RepairCardMedia.tarjeta_id == t.id, RepairCardMedia.deleted_at.is_(None))
        .order_by(RepairCardMedia.position.asc(), RepairCardMedia.id.asc())
        .all()
    )
    fotos = []
    for m in media_rows:
        url = _resolve_media_url(m.url, m.storage_key)
        thumb = _resolve_media_url(m.thumb_url or m.url, m.storage_key)
        if url:
            fotos.append({"url": url, "thumb_url": thumb or url, "position": m.position})

    cover = (t.image_url or "").strip()
    if cover and cover.startswith("http") and not any(f["url"] == cover for f in fotos):
        fotos.insert(0, {"url": cover, "thumb_url": cover, "position": -1})

    return {
        "folio": t.id,
        "nombre_propietario": (t.owner_name or "Cliente").strip(),
        "estado": public_status_label(t.status),
        "estado_key": t.status,
        "problema": summarize_problem(t.problem),
        "fecha_inicio": utc_iso_z(t.start_date),
        "fecha_limite": t.due_date.strftime("%Y-%m-%d") if t.due_date else None,
        "tiene_cargador": t.has_charger,
        "fotos": fotos,
        "fotos_count": len(fotos),
    }
