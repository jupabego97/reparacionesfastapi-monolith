"""API pública de seguimiento por token."""

from tests.conftest import client


def test_seguimiento_publico_not_found():
    r = client.get("/api/public/seguimiento/token_invalido_corto")
    assert r.status_code == 404


def test_seguimiento_publico_ok(auth_headers):
    cr = client.post(
        "/api/tarjetas",
        json={
            "nombre_propietario": "Cliente Público",
            "problema": "Prueba seguimiento",
            "whatsapp": "3001112233",
        },
        headers=auth_headers,
    )
    assert cr.status_code == 201
    tid = cr.json()["id"]
    detail = client.get(f"/api/tarjetas/{tid}", headers=auth_headers)
    assert detail.status_code == 200

    # Token asignado al crear
    from app.core.database import SessionLocal
    from app.models.repair_card import RepairCard

    db = SessionLocal()
    try:
        card = db.query(RepairCard).filter(RepairCard.id == tid).first()
        assert card and card.tracking_token
        token = card.tracking_token
    finally:
        db.close()

    pub = client.get(f"/api/public/seguimiento/{token}")
    assert pub.status_code == 200
    body = pub.json()
    assert body["folio"] == tid
    assert body["nombre_propietario"] == "Cliente Público"
    assert "estado" in body
    assert "fotos" in body
