"""Envío por Meta WhatsApp Cloud API (Business).

Modo desactivado si faltan credenciales o WHATSAPP_ENABLED=false.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

import httpx
from loguru import logger

from app.core.config import Settings


@dataclass
class WhatsappSendResult:
    ok: bool
    provider_message_id: str | None = None
    error: str | None = None
    http_status: int | None = None


def normalize_whatsapp_digits(phone: str | None, default_country_code: str = "57") -> str | None:
    """Normaliza a solo dígitos con prefijo país (Colombia: 10 dígitos que empiezan por 3 → 57…)."""
    if not phone or not str(phone).strip():
        return None
    digits = "".join(c for c in str(phone) if c.isdigit())
    cc = (default_country_code or "57").strip().lstrip("+") or "57"
    if len(digits) == 10 and digits.startswith("3"):
        digits = cc + digits
    if len(digits) < 10:
        return None
    return digits


def is_whatsapp_send_configured(settings: Settings) -> bool:
    if not getattr(settings, "whatsapp_enabled", False):
        return False
    token = (getattr(settings, "whatsapp_access_token", "") or "").strip()
    phone_id = (getattr(settings, "whatsapp_phone_number_id", "") or "").strip()
    return bool(token and phone_id)


def build_tarjeta_created_body(tarjeta: Any) -> str:
    """Texto plano para mensaje de confirmación al cliente (sin fecha de vencimiento)."""
    nombre = (getattr(tarjeta, "owner_name", None) or "Cliente").strip()
    prob = (getattr(tarjeta, "problem", None) or "Sin descripción").strip()
    if len(prob) > 500:
        prob = prob[:497] + "..."
    tid = getattr(tarjeta, "id", "") or "?"
    return (
        f"Hola {nombre}, registramos tu equipo para reparación.\n"
        f"Folio: #{tid}\n"
        f"Motivo: {prob}\n"
        "Te avisaremos por este canal cuando haya novedades."
    )


def default_template_body_parameters(tarjeta: Any) -> list[str]:
    """Valores por defecto para variables de plantilla (body). La 4ª posición queda vacía (sin fecha de vencimiento)."""
    nombre = (getattr(tarjeta, "owner_name", None) or "Cliente").strip()
    prob = (getattr(tarjeta, "problem", None) or "")[:120]
    tid = str(getattr(tarjeta, "id", "") or "")
    return [nombre, tid, prob, ""]


def _template_body_parameters(settings: Settings, tarjeta: Any | None) -> list[str] | None:
    """Parámetros del body de la plantilla Meta.

    - Vacío o ``auto``: rellena con datos de la tarjeta (nombre, folio, problema, fecha vacía).
    - ``[]`` (JSON): plantilla sin variables en el body (no se envía componente body).
    - Otro JSON array: valores fijos en orden.
    """
    raw = (getattr(settings, "whatsapp_template_body_params_json", "") or "").strip()
    if not raw or raw.lower() == "auto":
        if tarjeta is None:
            return []
        return default_template_body_parameters(tarjeta)
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        logger.warning("WHATSAPP_TEMPLATE_BODY_PARAMS_JSON no es JSON válido")
        return []
    if not isinstance(data, list):
        return []
    return [str(x) for x in data]


def _build_payload(
    settings: Settings,
    to_digits: str,
    body_text: str,
    tarjeta: Any | None,
) -> dict[str, Any]:
    tpl_name = (getattr(settings, "whatsapp_template_name", "") or "").strip()
    if tpl_name:
        lang = (getattr(settings, "whatsapp_template_language", None) or "es").strip() or "es"
        tpl: dict[str, Any] = {"name": tpl_name, "language": {"code": lang}}
        params = _template_body_parameters(settings, tarjeta)
        # params == [] → plantilla sin variables de body; no añadir components
        if params is not None and len(params) > 0:
            tpl["components"] = [
                {"type": "body", "parameters": [{"type": "text", "text": p} for p in params]},
            ]
        return {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": to_digits,
            "type": "template",
            "template": tpl,
        }
    return {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": to_digits,
        "type": "text",
        "text": {"preview_url": False, "body": body_text[:4096]},
    }


async def send_whatsapp_message(
    settings: Settings,
    *,
    to_digits: str,
    body_text: str,
    tarjeta: Any | None = None,
) -> WhatsappSendResult:
    """POST a /messages de Graph API."""
    if not is_whatsapp_send_configured(settings):
        return WhatsappSendResult(ok=False, error="whatsapp_not_configured", http_status=None)

    token = settings.whatsapp_access_token.strip()
    phone_id = settings.whatsapp_phone_number_id.strip()
    ver = (settings.whatsapp_graph_version or "v21.0").strip().strip("/")
    url = f"https://graph.facebook.com/{ver}/{phone_id}/messages"
    tpl_name = (getattr(settings, "whatsapp_template_name", "") or "").strip()
    if not tpl_name:
        logger.warning(
            "WhatsApp: WHATSAPP_TEMPLATE_NAME vacío; se envía mensaje de texto libre. "
            "Meta suele exigir plantilla aprobada para el primer contacto al cliente."
        )

    payload = _build_payload(settings, to_digits, body_text, tarjeta)

    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            r = await client.post(url, json=payload, headers=headers)
    except httpx.RequestError as e:
        logger.exception("WhatsApp HTTP error: {}", e)
        return WhatsappSendResult(ok=False, error=str(e), http_status=None)

    try:
        data = r.json()
    except Exception:
        data = {}

    if r.status_code >= 400:
        err = data.get("error", {})
        msg = err.get("message") if isinstance(err, dict) else r.text
        return WhatsappSendResult(ok=False, error=msg or f"HTTP {r.status_code}", http_status=r.status_code)

    mids = data.get("messages") or []
    mid = None
    if isinstance(mids, list) and mids and isinstance(mids[0], dict):
        mid = mids[0].get("id")
    return WhatsappSendResult(ok=True, provider_message_id=mid, http_status=r.status_code)
