"""Security and authentication tests."""

from tests.conftest import client


def test_health_live_and_ready_endpoints():
    live = client.get("/health/live")
    ready = client.get("/health/ready")
    assert live.status_code == 200
    assert ready.status_code in (200, 503)
    assert "status" in live.json()


def test_debug_schema_disabled_by_default():
    resp = client.get("/debug/schema")
    assert resp.status_code == 404


def test_http_error_envelope_shape(auth_headers):
    resp = client.get("/api/tarjetas/999999", headers=auth_headers)
    assert resp.status_code == 404
    body = resp.json()
    assert "code" in body
    assert "message" in body
    assert "request_id" in body


def test_tarjetas_list_requires_auth():
    assert client.get("/api/tarjetas").status_code == 401


def test_tarjeta_detail_requires_auth():
    assert client.get("/api/tarjetas/1").status_code == 401


def test_create_tarjeta_requires_auth():
    r = client.post("/api/tarjetas", json={"nombre_propietario": "X", "problema": "Y"})
    assert r.status_code == 401


def test_kanban_write_requires_auth():
    r = client.post("/api/columnas", json={"key": "extra", "title": "Extra"})
    assert r.status_code == 401


def test_export_requires_auth():
    assert client.get("/api/exportar").status_code == 401


def test_estadisticas_requires_auth():
    assert client.get("/api/estadisticas").status_code == 401


def test_ia_requires_auth():
    r = client.post("/api/procesar-imagen", json={"image": "abc"})
    assert r.status_code == 401


def test_plantillas_requires_auth():
    assert client.get("/api/plantillas").status_code == 401


def test_actividad_requires_auth():
    assert client.get("/api/actividad").status_code == 401


def test_permanent_delete_requires_admin(tech_headers, sample_tarjeta):
    r = client.delete(
        f"/api/tarjetas/{sample_tarjeta.id}/permanent",
        headers=tech_headers,
    )
    assert r.status_code == 403


def test_permanent_delete_as_admin(auth_headers, sample_tarjeta):
    r = client.delete(
        f"/api/tarjetas/{sample_tarjeta.id}/permanent",
        headers=auth_headers,
    )
    assert r.status_code == 204


def test_delete_requires_auth(sample_tarjeta):
    r = client.delete(f"/api/tarjetas/{sample_tarjeta.id}")
    assert r.status_code == 401


def test_trash_requires_auth():
    r = client.get("/api/tarjetas/trash/list")
    assert r.status_code == 401


def test_batch_positions_requires_auth():
    r = client.put("/api/tarjetas/batch/positions", json={
        "items": [{"id": 1, "columna": "ingresado", "posicion": 0}]
    })
    assert r.status_code == 401


def test_batch_operations_requires_auth():
    r = client.post("/api/tarjetas/batch", json={
        "ids": [1],
        "action": "delete",
    })
    assert r.status_code == 401


def test_block_requires_auth(sample_tarjeta):
    r = client.patch(f"/api/tarjetas/{sample_tarjeta.id}/block", json={
        "blocked": True,
        "reason": "Test",
    })
    assert r.status_code == 401


def test_block_with_auth(auth_headers, sample_tarjeta):
    r = client.patch(f"/api/tarjetas/{sample_tarjeta.id}/block", json={
        "blocked": True,
        "reason": "Waiting for parts",
    }, headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["bloqueada"] is True


def test_media_upload_requires_auth(sample_tarjeta):
    r = client.post(f"/api/tarjetas/{sample_tarjeta.id}/media")
    assert r.status_code in (401, 422)


def test_restore_requires_auth(sample_tarjeta):
    r = client.put(f"/api/tarjetas/{sample_tarjeta.id}/restore")
    assert r.status_code == 401
