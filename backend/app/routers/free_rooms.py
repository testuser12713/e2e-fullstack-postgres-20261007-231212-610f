"""Free-room search: rooms with enough seats and no overlapping booking.

The overlap predicate itself lives exactly once, in
``app.services.booking_rules.overlapping_booking``; this router only parses the
request, selects the candidate rooms by seat count and asks that one helper per
candidate whether it is free.
"""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.errors import AppError
from app.models import Room
from app.schemas import RoomRead
from app.services.booking_rules import overlapping_booking

router = APIRouter(prefix="/api", tags=["free-rooms"])


def _parse_timestamp(value: str, field: str) -> datetime:
    """Parse a timezone-aware ISO-8601 timestamp or reject it with 422."""
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError:
        raise AppError(
            "validation_error",
            422,
            f"The '{field}' parameter is not a valid ISO-8601 timestamp.",
            {field: "Must be an ISO-8601 timestamp, e.g. 2026-11-10T09:00:00+01:00."},
        ) from None
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        raise AppError(
            "validation_error",
            422,
            f"The '{field}' parameter must be timezone-aware.",
            {field: "Must be a timezone-aware ISO-8601 timestamp with an offset."},
        )
    return parsed


@router.get("/free-rooms", response_model=list[RoomRead])
def free_rooms(
    start: str,
    end: str,
    min_seats: int,
    db: Session = Depends(get_db),
) -> list[Room]:
    """Return every room with at least ``min_seats`` seats and no overlap of [start, end)."""
    start_dt = _parse_timestamp(start, "start")
    end_dt = _parse_timestamp(end, "end")
    if end_dt <= start_dt:
        raise AppError(
            "validation_error",
            422,
            "The end time must be after the start time.",
            {"end": "The end time must be after the start time."},
        )

    candidates = (
        db.execute(select(Room).where(Room.seats >= min_seats).order_by(Room.id)).scalars().all()
    )
    return [
        room for room in candidates if overlapping_booking(db, room.id, start_dt, end_dt) is None
    ]
