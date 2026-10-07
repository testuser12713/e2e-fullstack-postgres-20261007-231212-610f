"""Tests for the room day view endpoint (AC-09).

The bookings and rooms routers are still stubs, so the fixtures create the rows
directly through the shared session (only the tables this suite owns).
"""

from __future__ import annotations

import itertools
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from app.config import get_settings
from app.models import Booking, Room

_room_counter = itertools.count(1)


def _office_tz() -> ZoneInfo:
    return ZoneInfo(get_settings().office_tz)


def _local(day: date, hour: int, minute: int = 0) -> datetime:
    """A timezone-aware datetime at the given local office time."""
    return datetime(day.year, day.month, day.day, hour, minute, tzinfo=_office_tz())


def _make_room(db_session, name: str | None = None, seats: int = 4) -> Room:
    # The name is unique per call: the suite runs against a persistent schema,
    # so a repeated name would hit the case-insensitive unique index.
    room = Room(name=name or f"Raum {next(_room_counter)}", seats=seats, amenities=[])
    db_session.add(room)
    db_session.commit()
    return room


def _make_booking(
    db_session,
    room: Room,
    start: datetime,
    end: datetime,
    *,
    title: str = "Meeting",
    booked_by: str = "Ada",
) -> Booking:
    booking = Booking(room_id=room.id, booked_by=booked_by, title=title, start=start, end=end)
    db_session.add(booking)
    db_session.commit()
    return booking


def test_unknown_room_returns_404(client):
    response = client.get("/api/rooms/999999/bookings", params={"day": "2026-03-10"})
    assert response.status_code == 404
    body = response.json()
    assert body["code"] == "not_found"
    assert isinstance(body["message"], str) and body["message"]
    assert body["fields"] is None


def test_invalid_day_is_a_validation_error(client):
    response = client.get("/api/rooms/1/bookings", params={"day": "not-a-date"})
    assert response.status_code == 422
    assert response.json()["code"] == "validation_error"


def test_returns_only_overlapping_bookings_sorted_ascending(client, db_session):
    room = _make_room(db_session)
    day = date(2026, 3, 10)
    early = _make_booking(db_session, room, _local(day, 8), _local(day, 9), title="Frueh")
    late = _make_booking(db_session, room, _local(day, 15), _local(day, 16), title="Spaet")
    _make_booking(
        db_session,
        room,
        _local(day - timedelta(days=1), 22),
        _local(day - timedelta(days=1), 23),
        title="Gestern",
    )
    _make_booking(
        db_session,
        room,
        _local(day + timedelta(days=1), 1),
        _local(day + timedelta(days=1), 2),
        title="Morgen",
    )

    response = client.get(f"/api/rooms/{room.id}/bookings", params={"day": day.isoformat()})
    assert response.status_code == 200
    body = response.json()
    assert [b["title"] for b in body] == ["Frueh", "Spaet"]
    assert [b["id"] for b in body] == [early.id, late.id]
    assert all(b["room_name"] == room.name for b in body)
    assert all(b["room_id"] == room.id for b in body)
    # Ascending by start.
    starts = [b["start"] for b in body]
    assert starts == sorted(starts)


def test_different_day_returns_a_different_list(client, db_session):
    room = _make_room(db_session)
    day_one = date(2026, 3, 10)
    day_two = date(2026, 3, 11)
    _make_booking(db_session, room, _local(day_one, 9), _local(day_one, 10), title="Tag eins")

    first = client.get(f"/api/rooms/{room.id}/bookings", params={"day": day_one.isoformat()})
    second = client.get(f"/api/rooms/{room.id}/bookings", params={"day": day_two.isoformat()})
    assert first.status_code == 200
    assert second.status_code == 200
    assert [b["title"] for b in first.json()] == ["Tag eins"]
    assert second.json() == []


def test_booking_crossing_midnight_appears_in_both_days(client, db_session):
    room = _make_room(db_session)
    day = date(2026, 3, 10)
    crossing = _make_booking(
        db_session,
        room,
        _local(day, 23, 30),
        _local(day + timedelta(days=1), 0, 30),
        title="Nacht",
    )
    next_day = day + timedelta(days=1)

    on_first = client.get(f"/api/rooms/{room.id}/bookings", params={"day": day.isoformat()})
    on_second = client.get(f"/api/rooms/{room.id}/bookings", params={"day": next_day.isoformat()})
    assert [b["id"] for b in on_first.json()] == [crossing.id]
    assert [b["id"] for b in on_second.json()] == [crossing.id]


def test_day_interval_is_half_open(client, db_session):
    room = _make_room(db_session)
    day = date(2026, 3, 10)
    _make_booking(
        db_session,
        room,
        _local(day - timedelta(days=1), 22),
        _local(day, 0),
        title="endet zu Tagesbeginn",
    )
    _make_booking(
        db_session,
        room,
        _local(day + timedelta(days=1), 0),
        _local(day + timedelta(days=1), 1),
        title="beginnt zu Tagesende",
    )

    response = client.get(f"/api/rooms/{room.id}/bookings", params={"day": day.isoformat()})
    assert response.status_code == 200
    assert response.json() == []


def test_bookings_of_another_room_are_excluded(client, db_session):
    room = _make_room(db_session, name="Raum A")
    other = _make_room(db_session, name="Raum B")
    day = date(2026, 3, 10)
    mine = _make_booking(db_session, room, _local(day, 9), _local(day, 10), title="Meins")
    _make_booking(db_session, other, _local(day, 9), _local(day, 10), title="Anderer Raum")

    response = client.get(f"/api/rooms/{room.id}/bookings", params={"day": day.isoformat()})
    assert response.status_code == 200
    assert [b["id"] for b in response.json()] == [mine.id]
