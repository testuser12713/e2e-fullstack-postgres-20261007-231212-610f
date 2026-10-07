"""Tests for the free-room search endpoint (AC-10).

Every test builds its own rooms and bookings and removes them again, so the
module never depends on rows another ticket's tests happen to have left behind.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta

import pytest
from sqlalchemy.orm import Session

from app.models import Booking, Room

WINDOW_START = "2026-11-10T09:00:00+01:00"
WINDOW_END = "2026-11-10T10:00:00+01:00"
MIN_SEATS = 5


@pytest.fixture
def scenario(db_session: Session):
    """A controlled set of rooms/bookings, tagged with a unique token."""
    token = uuid.uuid4().hex
    start = datetime.fromisoformat(WINDOW_START)
    end = datetime.fromisoformat(WINDOW_END)

    def make_room(label: str, seats: int) -> Room:
        room = Room(name=f"FRT {token} {label}", seats=seats, amenities=[token])
        db_session.add(room)
        db_session.commit()
        return room

    free = make_room("free", 10)
    small = make_room("small", 2)
    booked = make_room("booked", 12)
    edge = make_room("edge", 8)
    after = make_room("after", 6)

    db_session.add_all(
        [
            # Overlaps the requested window in its middle.
            Booking(
                room_id=booked.id,
                booked_by="Alice",
                title="Standup",
                start=start + timedelta(minutes=30),
                end=start + timedelta(minutes=45),
            ),
            # Ends exactly when the window starts — half-open, so NOT overlapping.
            Booking(
                room_id=edge.id,
                booked_by="Bob",
                title="Früher Termin",
                start=start - timedelta(hours=1),
                end=start,
            ),
            # Starts exactly when the window ends — half-open, so NOT overlapping.
            Booking(
                room_id=after.id,
                booked_by="Carol",
                title="Später Termin",
                start=end,
                end=end + timedelta(hours=1),
            ),
        ]
    )
    db_session.commit()

    yield {
        "token": token,
        "free": free,
        "small": small,
        "booked": booked,
        "edge": edge,
        "after": after,
    }

    for room in (free, small, booked, edge, after):
        db_session.delete(room)
    db_session.commit()


def _query(client, start: str = WINDOW_START, end: str = WINDOW_END, min_seats: int = MIN_SEATS):
    return client.get(
        "/api/free-rooms",
        params={"start": start, "end": end, "min_seats": min_seats},
    )


def _mine(payload: list[dict], token: str) -> list[dict]:
    return [room for room in payload if token in room["amenities"]]


def test_returns_exactly_the_free_rooms_with_enough_seats(client, scenario):
    response = _query(client)
    assert response.status_code == 200

    mine = _mine(response.json(), scenario["token"])
    ids = {room["id"] for room in mine}

    assert ids == {scenario["free"].id, scenario["edge"].id, scenario["after"].id}


def test_room_with_overlapping_booking_is_excluded(client, scenario):
    response = _query(client)
    ids = {room["id"] for room in _mine(response.json(), scenario["token"])}
    assert scenario["booked"].id not in ids


def test_room_below_min_seats_is_excluded(client, scenario):
    response = _query(client)
    ids = {room["id"] for room in _mine(response.json(), scenario["token"])}
    assert scenario["small"].id not in ids


def test_every_returned_room_reaches_min_seats(client, scenario):
    response = _query(client)
    assert all(room["seats"] >= MIN_SEATS for room in response.json())


def test_room_read_shape(client, scenario):
    response = _query(client)
    rooms = _mine(response.json(), scenario["token"])
    assert rooms
    assert set(rooms[0]) == {"id", "name", "seats", "amenities"}


def test_rejects_end_not_after_start(client):
    response = _query(client, start=WINDOW_END, end=WINDOW_START)
    assert response.status_code == 422
    body = response.json()
    assert set(body) == {"code", "message", "fields"}
    assert body["code"] == "validation_error"
    assert body["message"]


def test_rejects_equal_start_and_end(client):
    response = _query(client, start=WINDOW_START, end=WINDOW_START)
    assert response.status_code == 422
    assert response.json()["code"] == "validation_error"


def test_rejects_unparsable_timestamp(client):
    response = _query(client, start="not-a-timestamp")
    assert response.status_code == 422
    body = response.json()
    assert body["code"] == "validation_error"
    assert body["fields"]


def test_rejects_naive_timestamp(client):
    response = _query(client, start="2026-11-10T09:00:00")
    assert response.status_code == 422
    assert response.json()["code"] == "validation_error"


def test_route_is_wired_under_its_agreed_path(client):
    # Without parameters the route must answer 422 (validation), never 404.
    response = client.get("/api/free-rooms")
    assert response.status_code == 422
