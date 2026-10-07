"""Tests for the rooms CRUD API (ticket: rooms CRUD with case-insensitive name)."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from app.models import Booking, Room


def _unique_name(prefix: str = "Room") -> str:
    return f"{prefix}-{uuid.uuid4().hex[:10]}"


def test_create_room_returns_201_and_appears_in_list(client):
    name = _unique_name("Alpha")
    response = client.post(
        "/api/rooms", json={"name": name, "seats": 4, "amenities": ["Beamer", "Whiteboard"]}
    )
    assert response.status_code == 201
    created = response.json()
    assert created["id"] > 0
    assert created["name"] == name
    assert created["seats"] == 4
    assert created["amenities"] == ["Beamer", "Whiteboard"]

    listing = client.get("/api/rooms")
    assert listing.status_code == 200
    ids = [room["id"] for room in listing.json()]
    assert created["id"] in ids


def test_duplicate_name_in_other_case_is_rejected_with_409(client):
    name = _unique_name("Alpha")
    assert client.post("/api/rooms", json={"name": name, "seats": 2}).status_code == 201

    conflict = client.post("/api/rooms", json={"name": name.upper(), "seats": 2})
    assert conflict.status_code == 409
    assert conflict.json()["code"] == "room_name_conflict"


def test_get_room_returns_it_and_404_for_unknown(client):
    created = client.post(
        "/api/rooms", json={"name": _unique_name(), "seats": 3, "amenities": []}
    ).json()

    fetched = client.get(f"/api/rooms/{created['id']}")
    assert fetched.status_code == 200
    assert fetched.json()["id"] == created["id"]

    missing = client.get("/api/rooms/999999999")
    assert missing.status_code == 404
    assert missing.json()["code"] == "not_found"


def test_update_replaces_name_seats_and_amenities(client):
    created = client.post(
        "/api/rooms",
        json={"name": _unique_name(), "seats": 2, "amenities": ["Beamer"]},
    ).json()
    new_name = _unique_name("Updated")

    updated = client.put(
        f"/api/rooms/{created['id']}",
        json={"name": new_name, "seats": 8, "amenities": ["TV", "Whiteboard", "Catering"]},
    )
    assert updated.status_code == 200
    body = updated.json()
    assert body["name"] == new_name
    assert body["seats"] == 8
    assert body["amenities"] == ["TV", "Whiteboard", "Catering"]

    empty = client.put(
        f"/api/rooms/{created['id']}",
        json={"name": new_name, "seats": 8, "amenities": []},
    )
    assert empty.status_code == 200
    assert empty.json()["amenities"] == []


def test_update_rejects_name_conflict_and_unknown_room(client):
    name_a = _unique_name("A")
    name_b = _unique_name("B")
    room_a = client.post("/api/rooms", json={"name": name_a, "seats": 1}).json()
    client.post("/api/rooms", json={"name": name_b, "seats": 1})

    conflict = client.put(f"/api/rooms/{room_a['id']}", json={"name": name_b.upper(), "seats": 1})
    assert conflict.status_code == 409
    assert conflict.json()["code"] == "room_name_conflict"

    missing = client.put("/api/rooms/999999999", json={"name": _unique_name(), "seats": 1})
    assert missing.status_code == 404


def test_delete_room_without_bookings_returns_204(client):
    created = client.post("/api/rooms", json={"name": _unique_name(), "seats": 2}).json()

    deleted = client.delete(f"/api/rooms/{created['id']}")
    assert deleted.status_code == 204
    assert client.get(f"/api/rooms/{created['id']}").status_code == 404

    missing = client.delete("/api/rooms/999999999")
    assert missing.status_code == 404


def test_delete_room_with_future_booking_is_refused_and_keeps_booking(client, db_session):
    created = client.post("/api/rooms", json={"name": _unique_name(), "seats": 2}).json()
    now = datetime.now(UTC)
    booking = Booking(
        room_id=created["id"],
        booked_by="Ada",
        title="Sprint review",
        start=now + timedelta(days=1),
        end=now + timedelta(days=1, hours=1),
    )
    db_session.add(booking)
    db_session.commit()

    refused = client.delete(f"/api/rooms/{created['id']}")
    assert refused.status_code == 409
    assert refused.json()["code"] == "room_has_future_bookings"

    # The refusal must not delete the booking nor the room.
    assert db_session.get(Booking, booking.id) is not None
    assert client.get(f"/api/rooms/{created['id']}").status_code == 200


def test_delete_room_with_only_past_bookings_succeeds(client, db_session):
    created = client.post("/api/rooms", json={"name": _unique_name(), "seats": 2}).json()
    now = datetime.now(UTC)
    booking = Booking(
        room_id=created["id"],
        booked_by="Grace",
        title="Retro",
        start=now - timedelta(hours=2),
        end=now - timedelta(hours=1),
    )
    db_session.add(booking)
    db_session.commit()

    deleted = client.delete(f"/api/rooms/{created['id']}")
    assert deleted.status_code == 204


def test_database_room_row_is_created(client, db_session):
    name = _unique_name("DbRoom")
    created = client.post("/api/rooms", json={"name": name, "seats": 5}).json()

    row = db_session.get(Room, created["id"])
    assert row is not None
    assert row.name == name
    assert row.seats == 5
