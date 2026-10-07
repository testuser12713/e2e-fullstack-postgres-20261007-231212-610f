"""The single home of the booking rules.

Both the bookings router and the free-room search go through these helpers, so
the overlap predicate exists exactly once in the whole product.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.errors import AppError
from app.models import Booking

MAX_DURATION = timedelta(hours=8)


def overlapping_booking(
    db: Session,
    room_id: int,
    start: datetime,
    end: datetime,
    exclude_booking_id: int | None = None,
) -> Booking | None:
    """Return the first booking of `room_id` that overlaps [start, end).

    The interval is half-open: a booking starting exactly when another ends does
    NOT overlap. This is the only overlap query of the product.
    """
    stmt = select(Booking).where(
        Booking.room_id == room_id,
        Booking.start < end,
        Booking.end > start,
    )
    if exclude_booking_id is not None:
        stmt = stmt.where(Booking.id != exclude_booking_id)
    return db.execute(stmt).scalars().first()


def check_duration(start: datetime, end: datetime) -> None:
    """Reject an empty, negative or longer-than-8-hours booking with 422."""
    if end <= start:
        raise AppError(
            "validation_error",
            422,
            "The end time must be after the start time.",
            {"end": "The end time must be after the start time."},
        )
    if end - start > MAX_DURATION:
        raise AppError(
            "validation_error",
            422,
            "A booking may not be longer than 8 hours.",
            {"end": "A booking may not be longer than 8 hours."},
        )


def check_editable(booking: Booking) -> None:
    """Reject changing or deleting a booking that has already started with 422."""
    if booking.start <= datetime.now(UTC):
        raise AppError(
            "booking_already_started",
            422,
            "This booking has already started and can no longer be changed.",
            {"start": "This booking has already started and can no longer be changed."},
        )
