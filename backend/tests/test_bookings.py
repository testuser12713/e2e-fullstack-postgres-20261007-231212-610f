"""Tests for the bookings CRUD API and its rules.

Rooms are created directly through the session (the rooms API belongs to another
ticket), one room per test so the shared test database cannot leak between tests.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import uuid4

from app.models import Room


def _make_room(db_session, seats: int = 4) -> Room:
    room = Room(name=f"Room {uuid4().hex[:12]}", seats=seats, amenities=[])
    db_session.add(room)
    db_session.commit()
    db_session.refresh(room)
    return room


def _payload(room_id: int, start: datetime, end: datetime, **overrides) -> dict:
    data = {
        "room_id": room_id,
        "booked_by": "Ada",
        "title": "Standup",
        "start": start.isoformat(),
        "end": end.isoformat(),
    }
    data.update(overrides)
    return data


def test_create_booking_returns_room_reference_and_name(client, db_session):
    room = _make_room(db_session)
    start = datetime(2030, 1, 2, 9, 0, tzinfo=UTC)
    end = start + timedelta(hours=2)

    response = client.post("/api/bookings", json=_payload(room.id, start, end))

    assert response.status_code == 201
    body = response.json()
    assert body["room_id"] == room.id
    assert body["room_name"] == room.name
    assert body["booked_by"] == "Ada"
    assert body["title"] == "Standup"
    assert isinstance(body["id"], int)


def test_booking_longer_than_eight_hours_is_rejected(client, db_session):
    room = _make_room(db_session)
    start = datetime(2030, 1, 2, 9, 0, tzinfo=UTC)
    end = start + timedelta(hours=9)

    response = client.post("/api/bookings", json=_payload(room.id, start, end))

    assert response.status_code == 422
    body = response.json()
    assert body["code"] == "validation_error"
    assert "8" in body["message"]


def test_end_not_after_start_is_rejected(client, db_session):
    room = _make_room(db_session)
    start = datetime(2030, 1, 2, 9, 0, tzinfo=UTC)

    response = client.post("/api/bookings", json=_payload(room.id, start, start))

    assert response.status_code == 422
    body = response.json()
    assert body["code"] == "validation_error"
    assert body["fields"] is not None
    assert "end" in body["fields"]


def test_overlapping_booking_is_rejected_and_names_the_conflict(client, db_session):
    room = _make_room(db_session)
    start = datetime(2030, 1, 2, 9, 0, tzinfo=UTC)
    end = start + timedelta(hours=2)
    first = client.post(
        "/api/bookings",
        json=_payload(room.id, start, end, title="Blocking meeting", booked_by="Grace"),
    )
    assert first.status_code == 201

    second = client.post(
        "/api/bookings",
        json=_payload(room.id, start + timedelta(minutes=30), end + timedelta(minutes=30)),
    )

    assert second.status_code == 409
    body = second.json()
    assert body["code"] == "booking_overlap"
    assert "Blocking meeting" in body["message"]


def test_adjacent_bookings_are_accepted(client, db_session):
    room = _make_room(db_session)
    start = datetime(2030, 1, 2, 10, 0, tzinfo=UTC)
    end = start + timedelta(hours=2)
    assert client.post("/api/bookings", json=_payload(room.id, start, end)).status_code == 201

    adjacent = client.post("/api/bookings", json=_payload(room.id, end, end + timedelta(hours=2)))

    assert adjacent.status_code == 201


def test_get_unknown_booking_returns_404(client):
    response = client.get("/api/bookings/999999")
    assert response.status_code == 404
    assert response.json()["code"] == "not_found"


def test_list_bookings_for_room(client, db_session):
    room = _make_room(db_session)
    start = datetime(2030, 1, 2, 9, 0, tzinfo=UTC)
    client.post("/api/bookings", json=_payload(room.id, start, start + timedelta(hours=1)))
    client.post(
        "/api/bookings",
        json=_payload(room.id, start + timedelta(hours=2), start + timedelta(hours=3)),
    )

    response = client.get("/api/bookings", params={"room_id": room.id})

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 2
    assert body[0]["start"] < body[1]["start"]


def test_update_booking(client, db_session):
    room = _make_room(db_session)
    start = datetime(2030, 1, 2, 9, 0, tzinfo=UTC)
    created = client.post(
        "/api/bookings", json=_payload(room.id, start, start + timedelta(hours=1))
    ).json()

    new_start = start + timedelta(hours=3)
    response = client.put(
        f"/api/bookings/{created['id']}",
        json=_payload(room.id, new_start, new_start + timedelta(hours=2), title="Renamed"),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == created["id"]
    assert body["title"] == "Renamed"


def test_update_started_booking_is_refused(client, db_session):
    room = _make_room(db_session)
    now = datetime.now(UTC)
    created = client.post(
        "/api/bookings",
        json=_payload(room.id, now - timedelta(hours=2), now - timedelta(hours=1)),
    ).json()

    new_start = now + timedelta(hours=5)
    response = client.put(
        f"/api/bookings/{created['id']}",
        json=_payload(room.id, new_start, new_start + timedelta(hours=1)),
    )

    assert response.status_code == 422
    body = response.json()
    assert body["code"] == "booking_already_started"


def test_delete_started_booking_is_refused(client, db_session):
    room = _make_room(db_session)
    now = datetime.now(UTC)
    created = client.post(
        "/api/bookings",
        json=_payload(room.id, now - timedelta(hours=2), now - timedelta(hours=1)),
    ).json()

    response = client.delete(f"/api/bookings/{created['id']}")

    assert response.status_code == 422
    assert response.json()["code"] == "booking_already_started"


def test_delete_booking(client, db_session):
    room = _make_room(db_session)
    start = datetime(2030, 1, 2, 9, 0, tzinfo=UTC)
    created = client.post(
        "/api/bookings", json=_payload(room.id, start, start + timedelta(hours=1))
    ).json()

    response = client.delete(f"/api/bookings/{created['id']}")

    assert response.status_code == 204
    assert client.get(f"/api/bookings/{created['id']}").status_code == 404
