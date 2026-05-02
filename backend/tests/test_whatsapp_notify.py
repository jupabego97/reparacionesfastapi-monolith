"""WhatsApp notify-created, normalización e idempotencia."""
from unittest.mock import patch

import pytest

from app.core.config import get_settings
from app.services.whatsapp_service import normalize_whatsapp_digits
from tests.conftest import client


def _clear_settings_cache() -> None:
    get_settings.cache_clear()


@pytest.fixture(autouse=True)
def _whatsapp_env_reset(monkeypatch):
    monkeypatch.delenv("WHATSAPP_ENABLED", raising=False)
    monkeypatch.delenv("WHATSAPP_ACCESS_TOKEN", raising=False)
    monkeypatch.delenv("WHATSAPP_PHONE_NUMBER_ID", raising=False)
    _clear_settings_cache()
    yield
    _clear_settings_cache()


def test_normalize_whatsapp_colombia_mobile():
    assert normalize_whatsapp_digits("300 123 4567") == "573001234567"
    assert normalize_whatsapp_digits("573001234567") == "573001234567"


def test_normalize_whatsapp_invalid():
    assert normalize_whatsapp_digits("") is None
    assert normalize_whatsapp_digits("12") is None


def test_notify_created_requires_auth():
    r = client.post("/api/tarjetas/1/notify-created")
    assert r.status_code == 401


def test_notify_created_not_found(auth_headers):
    r = client.post("/api/tarjetas/999999/notify-created", headers=auth_headers)
    assert r.status_code == 404


def test_notify_skipped_invalid_phone(auth_headers):
    r = client.post(
        "/api/tarjetas",
        json={"nombre_propietario": "x", "problema": "y", "whatsapp": "abc"},
        headers=auth_headers,
    )
    assert r.status_code == 201
    cid = r.json()["id"]
    out = client.post(f"/api/tarjetas/{cid}/notify-created", headers=auth_headers).json()
    assert out["status"] == "skipped"


def test_notify_skipped_whatsapp_not_configured(auth_headers):
    r = client.post(
        "/api/tarjetas",
        json={"nombre_propietario": "x", "problema": "y", "whatsapp": "3001234567"},
        headers=auth_headers,
    )
    assert r.status_code == 201
    cid = r.json()["id"]
    out = client.post(f"/api/tarjetas/{cid}/notify-created", headers=auth_headers).json()
    assert out["status"] == "skipped"
    assert "configurado" in (out.get("message") or "").lower()


def test_notify_sent_and_idempotent(auth_headers, monkeypatch):
    monkeypatch.setenv("WHATSAPP_ENABLED", "true")
    monkeypatch.setenv("WHATSAPP_ACCESS_TOKEN", "tok")
    monkeypatch.setenv("WHATSAPP_PHONE_NUMBER_ID", "111")
    _clear_settings_cache()

    r = client.post(
        "/api/tarjetas",
        json={"nombre_propietario": "x", "problema": "y", "whatsapp": "3007654321"},
        headers=auth_headers,
    )
    assert r.status_code == 201
    cid = r.json()["id"]

    class FakeClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return None

        async def post(self, *args, **kwargs):
            class Resp:
                status_code = 200

                def json(self):
                    return {"messages": [{"id": "wamid.TEST"}]}

            return Resp()

    with patch("app.services.whatsapp_service.httpx.AsyncClient", lambda **kw: FakeClient()):
        j = client.post(f"/api/tarjetas/{cid}/notify-created", headers=auth_headers).json()
    assert j["status"] == "sent"
    assert j.get("provider_message_id") == "wamid.TEST"

    j2 = client.post(f"/api/tarjetas/{cid}/notify-created", headers=auth_headers).json()
    assert j2["status"] == "skipped"
    assert "Ya se envió" in (j2.get("message") or "")


def test_notify_failed_logs_and_allows_retry(auth_headers, monkeypatch):
    monkeypatch.setenv("WHATSAPP_ENABLED", "true")
    monkeypatch.setenv("WHATSAPP_ACCESS_TOKEN", "tok")
    monkeypatch.setenv("WHATSAPP_PHONE_NUMBER_ID", "111")
    _clear_settings_cache()

    r = client.post(
        "/api/tarjetas",
        json={"nombre_propietario": "x", "problema": "y", "whatsapp": "3008889900"},
        headers=auth_headers,
    )
    cid = r.json()["id"]

    class FakeClientErr:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return None

        async def post(self, *args, **kwargs):
            class Resp:
                status_code = 400

                def json(self):
                    return {"error": {"message": "bad request"}}

            return Resp()

    with patch("app.services.whatsapp_service.httpx.AsyncClient", lambda **kw: FakeClientErr()):
        j = client.post(f"/api/tarjetas/{cid}/notify-created", headers=auth_headers).json()
    assert j["status"] == "failed"

    class FakeClientOk:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return None

        async def post(self, *args, **kwargs):
            class Resp:
                status_code = 200

                def json(self):
                    return {"messages": [{"id": "wamid.RETRY"}]}

            return Resp()

    with patch("app.services.whatsapp_service.httpx.AsyncClient", lambda **kw: FakeClientOk()):
        j2 = client.post(f"/api/tarjetas/{cid}/notify-created", headers=auth_headers).json()
    assert j2["status"] == "sent"
