"""Room day view: the bookings of one room that overlap a local office day.

AC-09: GET /api/rooms/{room_id}/bookings?day=YYYY-MM-DD returns exactly the
bookings of that room overlapping the local office day (start before the day's
end and end after the day's start), sorted ascending by start. An unknown room
answers 404 not_found.

The day boundaries are computed in the office timezone from
``Settings.OFFICE_TZ`` via ``zoneinfo`` — never from a hardcoded offset — so the
interval follows daylight-saving transitions of that zone.
"""

from __future__ import annotations

from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.errors import AppError
from app.models import Booking, Room
from app.schemas import BookingRead

router = APIRouter(prefix="/api", tags=["room-day"])


def office_day_bounds(day: date) -> tuple[datetime, datetime]:
    """Return the half-open ``[start, end)`` instants of a local office day.

    The bounds are local midnights in the configured office timezone. Adding a
    day to the aware start yields the next local midnight, so a daylight-saving
    transition inside the day is accounted for by the zone itself.
    """
    try:
        tz = ZoneInfo(get_settings().office_tz)
    except Exception as exc:  # unknown zone name -> a configuration error
        raise AppError("configuration_error", 500, "OFFICE_TZ is not a known timezone.") from exc
    start = datetime.combine(day, time.min, tzinfo=tz)
    end = start + timedelta(days=1)
    return start, end


@router.get("/rooms/{room_id}/bookings", response_model=list[BookingRead])
def room_day(
    room_id: int,
    day: date,
    db: Session = Depends(get_db),
) -> list[BookingRead]:
    """The bookings of a room overlapping the given local office day."""
    room = db.get(Room, room_id)
    if room is None:
        raise AppError("not_found", 404, "The room does not exist.")

    day_start, day_end = office_day_bounds(day)
    stmt = (
        select(Booking)
        .where(
            Booking.room_id == room_id,
            Booking.start < day_end,
            Booking.end > day_start,
        )
        .order_by(Booking.start.asc(), Booking.id.asc())
    )
    bookings = db.execute(stmt).scalars().all()
    return [
        BookingRead(
            id=booking.id,
            room_id=booking.room_id,
            room_name=room.name,
            booked_by=booking.booked_by,
            title=booking.title,
            start=booking.start,
            end=booking.end,
        )
        for booking in bookings
    ]
