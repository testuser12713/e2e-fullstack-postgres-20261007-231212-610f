"""Booking routes (stub until ticket #1 fills them)."""

from __future__ import annotations

from typing import NoReturn

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.errors import AppError
from app.schemas import BookingCreate, BookingRead

router = APIRouter(prefix="/api", tags=["bookings"])


def _not_implemented() -> NoReturn:
    raise AppError("not_implemented", 501, "Bookings CRUD is implemented by ticket #1.")


@router.get("/bookings", response_model=list[BookingRead])
def list_bookings(room_id: int, db: Session = Depends(get_db)) -> list[BookingRead]:
    _not_implemented()


@router.post("/bookings", response_model=BookingRead, status_code=201)
def create_booking(payload: BookingCreate, db: Session = Depends(get_db)) -> BookingRead:
    _not_implemented()


@router.get("/bookings/{booking_id}", response_model=BookingRead)
def get_booking(booking_id: int, db: Session = Depends(get_db)) -> BookingRead:
    _not_implemented()


@router.put("/bookings/{booking_id}", response_model=BookingRead)
def update_booking(
    booking_id: int, payload: BookingCreate, db: Session = Depends(get_db)
) -> BookingRead:
    _not_implemented()


@router.delete("/bookings/{booking_id}", status_code=204)
def delete_booking(booking_id: int, db: Session = Depends(get_db)) -> None:
    _not_implemented()
