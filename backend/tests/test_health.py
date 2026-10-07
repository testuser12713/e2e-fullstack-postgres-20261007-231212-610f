"""Tests for the running skeleton: health endpoint, routing and error contract."""

from __future__ import annotations

from app.models import Room


def test_health_returns_ok(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_rooms_route_is_wired(client):
    # The route must exist and be registered under the agreed path and verb.
    # It is a stub until ticket #10 fills it, so assert wiring, not its body.
    response = client.get("/api/rooms")
    assert response.status_code != 404


def test_unknown_route_uses_uniform_error_body(client):
    response = client.get("/api/does-not-exist")
    assert response.status_code == 404
    body = response.json()
    assert set(body) == {"code", "message", "fields"}
    assert body["code"] == "not_found"
    assert isinstance(body["message"], str)
    assert body["message"]


def test_validation_error_uses_uniform_body_with_fields(client):
    response = client.post("/api/rooms", json={})
    assert response.status_code == 422
    body = response.json()
    assert body["code"] == "validation_error"
    assert isinstance(body["fields"], dict)
    assert "name" in body["fields"]


def test_database_is_real_postgresql_and_roundtrips(db_session, engine):
    assert engine.dialect.name == "postgresql"
    room = Room(name="Testraum", seats=4, amenities=["Beamer", "Whiteboard"])
    db_session.add(room)
    db_session.commit()

    fetched = db_session.get(Room, room.id)
    assert fetched is not None
    assert fetched.name == "Testraum"
    assert fetched.seats == 4
    assert fetched.amenities == ["Beamer", "Whiteboard"]
