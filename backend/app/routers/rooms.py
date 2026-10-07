"""Rooms CRUD routes.

The room name is unique ignoring case (enforced by the functional unique index
on ``lower(name)``). Every failure is rendered through the uniform error body of
``app.errors``.
"""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.errors import AppError
from app.models import Booking, Room
from app.schemas import RoomCreate, RoomRead

router = APIRouter(prefix="/api", tags=["rooms"])


def _get_room_or_404(db: Session, room_id: int) -> Room:
    """Return the room or raise the uniform 404 error."""
    room = db.get(Room, room_id)
    if room is None:
        raise AppError(
            "not_found",
            404,
            f"Room {room_id} does not exist.",
            {"room_id": f"Room {room_id} does not exist."},
        )
    return room


def _ensure_name_free(db: Session, name: str, exclude_room_id: int | None = None) -> None:
    """Reject a name that another room already uses, ignoring case."""
    stmt = select(Room.id).where(func.lower(Room.name) == name.strip().lower())
    if exclude_room_id is not None:
        stmt = stmt.where(Room.id != exclude_room_id)
    if db.execute(stmt).first() is not None:
        raise AppError(
            "room_name_conflict",
            409,
            "A room with this name already exists.",
            {"name": "A room with this name already exists."},
        )


@router.get("/rooms", response_model=list[RoomRead])
def list_rooms(db: Session = Depends(get_db)) -> list[Room]:
    """List every room ordered by id."""
    return list(db.execute(select(Room).order_by(Room.id)).scalars().all())


@router.post("/rooms", response_model=RoomRead, status_code=201)
def create_room(payload: RoomCreate, db: Session = Depends(get_db)) -> Room:
    """Create a room, rejecting a duplicate name (ignoring case) with 409."""
    _ensure_name_free(db, payload.name)
    room = Room(name=payload.name, seats=payload.seats, amenities=list(payload.amenities))
    db.add(room)
    db.commit()
    db.refresh(room)
    return room


@router.get("/rooms/{room_id}", response_model=RoomRead)
def get_room(room_id: int, db: Session = Depends(get_db)) -> Room:
    """Return a single room or 404."""
    return _get_room_or_404(db, room_id)


@router.put("/rooms/{room_id}", response_model=RoomRead)
def update_room(room_id: int, payload: RoomCreate, db: Session = Depends(get_db)) -> Room:
    """Replace a room's name, seat count and amenity tags."""
    room = _get_room_or_404(db, room_id)
    _ensure_name_free(db, payload.name, exclude_room_id=room_id)
    room.name = payload.name
    room.seats = payload.seats
    room.amenities = list(payload.amenities)
    db.commit()
    db.refresh(room)
    return room


@router.delete("/rooms/{room_id}", status_code=204)
def delete_room(room_id: int, db: Session = Depends(get_db)) -> None:
    """Delete a room, refusing while it still has a booking ending in the future."""
    room = _get_room_or_404(db, room_id)
    has_future = db.execute(
        select(Booking.id).where(Booking.room_id == room_id, Booking.end > datetime.now(UTC))
    ).first()
    if has_future is not None:
        raise AppError(
            "room_has_future_bookings",
            409,
            "This room still has bookings in the future and cannot be deleted.",
            None,
        )
    db.delete(room)
    db.commit()
