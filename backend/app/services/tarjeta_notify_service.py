"""Envío WhatsApp al crear tarjeta (Meta Cloud API)."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.core.config import Settings
from app.models.outbound_message import OutboundMessage
from app.models.repair_card import RepairCard
from app.services.tracking_service import build_public_seguimiento_url, ensure_tracking_token
from app.services.whatsapp_service import (
    build_tarjeta_created_body,
    is_whatsapp_send_configured,
    normalize_whatsapp_digits,
    send_whatsapp_message,
)


def _log_outbound(
    db: Session,
    *,
    tarjeta_id: int,
    recipient: str,
    event: str,
    status: str,
    provider_message_id: str | None = None,
    error: str | None = None,
) -> OutboundMessage:
    row = OutboundMessage(
        tarjeta_id=tarjeta_id,
        channel="whatsapp",
        event=event,
        recipient=recipient,
        status=status,
        provider_message_id=provider_message_id,
        error=error,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


async def notify_tarjeta_created(
    db: Session,
    settings: Settings,
    tarjeta_id: int,
) -> dict:
    """Idempotente si ya hay envío exitoso. Asegura token de seguimiento antes del mensaje."""
    t = db.query(RepairCard).filter(RepairCard.id == tarjeta_id, RepairCard.deleted_at.is_(None)).first()
    if not t:
        return {"status": "error", "message": "Tarjeta no encontrada", "http_status": 404}

    already = (
        db.query(OutboundMessage)
        .filter(
            OutboundMessage.tarjeta_id == tarjeta_id,
            OutboundMessage.event == "tarjeta_created",
            OutboundMessage.status == "sent",
        )
        .first()
    )
    if already:
        return {
            "status": "skipped",
            "message": "Ya se envió WhatsApp para esta tarjeta",
            "provider_message_id": already.provider_message_id,
        }

    ensure_tracking_token(t, db)
    db.refresh(t)

    cc = (settings.whatsapp_default_country_code or "57").strip().lstrip("+") or "57"
    digits = normalize_whatsapp_digits(t.whatsapp_number, cc)
    if not digits:
        _log_outbound(
            db,
            tarjeta_id=tarjeta_id,
            recipient="",
            event="tarjeta_created",
            status="skipped",
            error="invalid_phone",
        )
        return {"status": "skipped", "message": "Teléfono WhatsApp inválido o vacío"}

    if not is_whatsapp_send_configured(settings):
        _log_outbound(
            db,
            tarjeta_id=tarjeta_id,
            recipient=digits,
            event="tarjeta_created",
            status="skipped",
            error="whatsapp_not_configured",
        )
        return {"status": "skipped", "message": "WhatsApp no está configurado en el servidor"}

    photos_url = build_public_seguimiento_url(settings, t, db)
    body = build_tarjeta_created_body(t, photos_url=photos_url)
    result = await send_whatsapp_message(settings, to_digits=digits, body_text=body, tarjeta=t, db=db)

    if result.ok:
        _log_outbound(
            db,
            tarjeta_id=tarjeta_id,
            recipient=digits,
            event="tarjeta_created",
            status="sent",
            provider_message_id=result.provider_message_id,
        )
        return {
            "status": "sent",
            "message": "Mensaje enviado",
            "provider_message_id": result.provider_message_id,
        }

    err = result.error or "unknown_error"
    _log_outbound(
        db,
        tarjeta_id=tarjeta_id,
        recipient=digits,
        event="tarjeta_created",
        status="failed",
        error=err[:2000] if err else None,
    )
    return {"status": "failed", "message": err}
