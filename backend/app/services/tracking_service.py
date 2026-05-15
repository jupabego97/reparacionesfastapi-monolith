"""Token y URL pública de seguimiento para que el cliente vea fotos de su reparación."""

from __future__ import annotations

import secrets
from typing import Any

from sqlalchemy.orm import Session

from app.core.config import Settings
from app.models.repair_card import RepairCard

STATUS_PUBLIC_LABELS: dict[str, str] = {
    "ingresado": "Ingresado",
    "diagnosticada": "En diagnóstico",
    "para_entregar": "Listo para entregar",
    "listos": "Entregado",
}


def generate_tracking_token() -> str:
    return secrets.token_urlsafe(24)


def ensure_tracking_token(card: RepairCard, db: Session) -> str:
    """Asigna token único si la tarjeta aún no tiene."""
    existing = (getattr(card, "tracking_token", None) or "").strip()
    if existing:
        return existing
    for _ in range(5):
        token = generate_tracking_token()
        clash = (
            db.query(RepairCard)
            .filter(RepairCard.tracking_token == token, RepairCard.id != card.id)
            .first()
        )
        if not clash:
            card.tracking_token = token
            db.commit()
            db.refresh(card)
            return token
    raise RuntimeError("No se pudo generar token de seguimiento único")


def build_public_seguimiento_url(settings: Settings, card: RepairCard, db: Session) -> str | None:
    base = (getattr(settings, "public_app_base_url", "") or "").strip().rstrip("/")
    if not base:
        return None
    token = ensure_tracking_token(card, db)
    return f"{base}/seguimiento/{token}"


def public_status_label(status_key: str | None) -> str:
    if not status_key:
        return "En proceso"
    return STATUS_PUBLIC_LABELS.get(status_key, status_key.replace("_", " ").title())


def summarize_problem(problem: str | None, max_len: int = 200) -> str:
    p = (problem or "").strip() or "Sin descripción"
    if len(p) > max_len:
        return p[: max_len - 3] + "..."
    return p
