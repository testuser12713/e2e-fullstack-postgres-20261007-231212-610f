"""Bookings CRUD routes.

Every rule lives in ``app.services.booking_rules``: this router only orchestrates
persistence and maps the rule outcomes onto the uniform error contract.
"""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.errors import AppError
from app.models import Booking, Room
from app.schemas import BookingCreate, BookingRead
from app.services.booking_rules import (
    check_duration,
    check_editable,
    overlapping_booking,
)

router = APIRouter(prefix="/api", tags=["bookings"])


def _require_room(db: Session, room_id: int) -> Room:
    room = db.get(Room, room_id)
    if room is None:
        raise AppError(
            "not_found",
            404,
            f"Room {room_id} does not exist.",
            {"room_id": "Room does not exist."},
        )
    return room


def _require_booking(db: Session, booking_id: int) -> Booking:
    booking = db.get(Booking, booking_id)
    if booking is None:
        raise AppError(
            "not_found",
            404,
            f"Booking {booking_id} does not exist.",
        )
    return booking


def _read(booking: Booking) -> BookingRead:
    return BookingRead(
        id=booking.id,
        room_id=booking.room_id,
        room_name=booking.room.name,
        booked_by=booking.booked_by,
        title=booking.title,
        start=booking.start,
        end=booking.end,
    )


def _reject_overlap(
    db: Session,
    room_id: int,
    start: datetime,
    end: datetime,
    exclude_booking_id: int | None = None,
) -> None:
    conflict = overlapping_booking(db, room_id, start, end, exclude_booking_id)
    if conflict is not None:
        raise AppError(
            "booking_overlap",
            409,
            (
                f"The room is already booked by {conflict.booked_by} for "
                f"'{conflict.title}' from {conflict.start.isoformat()} to "
                f"{conflict.end.isoformat()} (booking {conflict.id})."
            ),
            {"start": f"Overlaps booking {conflict.id}."},
        )


@router.get("/bookings", response_model=list[BookingRead])
def list_bookings(room_id: int, db: Session = Depends(get_db)) -> list[BookingRead]:
    statement = (
        select(Booking)
        .where(Booking.room_id == room_id)
        .order_by(Booking.start.asc(), Booking.id.asc())
    )
    return [_read(booking) for booking in db.execute(statement).scalars().all()]


@router.post("/bookings", response_model=BookingRead, status_code=201)
def create_booking(payload: BookingCreate, db: Session = Depends(get_db)) -> BookingRead:
    _require_room(db, payload.room_id)
    check_duration(payload.start, payload.end)
    _reject_overlap(db, payload.room_id, payload.start, payload.end)

    booking = Booking(
        room_id=payload.room_id,
        booked_by=payload.booked_by,
        title=payload.title,
        start=payload.start,
        end=payload.end,
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)
    return _read(booking)


@router.get("/bookings/{booking_id}", response_model=BookingRead)
def get_booking(booking_id: int, db: Session = Depends(get_db)) -> BookingRead:
    return _read(_require_booking(db, booking_id))


@router.put("/bookings/{booking_id}", response_model=BookingRead)
def update_booking(
    booking_id: int, payload: BookingCreate, db: Session = Depends(get_db)
) -> BookingRead:
    booking = _require_booking(db, booking_id)
    check_editable(booking)
    _require_room(db, payload.room_id)
    check_duration(payload.start, payload.end)
    _reject_overlap(db, payload.room_id, payload.start, payload.end, exclude_booking_id=booking_id)

    booking.room_id = payload.room_id
    booking.booked_by = payload.booked_by
    booking.title = payload.title
    booking.start = payload.start
    booking.end = payload.end
    db.commit()
    db.refresh(booking)
    return _read(booking)


@router.delete("/bookings/{booking_id}", status_code=204)
def delete_booking(booking_id: int, db: Session = Depends(get_db)) -> None:
    booking = _require_booking(db, booking_id)
    check_editable(booking)
    db.delete(booking)
    db.commit()
