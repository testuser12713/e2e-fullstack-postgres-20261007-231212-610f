"""Room day view (stub until ticket #2 fills it)."""

from __future__ import annotations

from typing import NoReturn

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.errors import AppError
from app.schemas import BookingRead

router = APIRouter(prefix="/api", tags=["room-day"])


def _not_implemented() -> NoReturn:
    raise AppError("not_implemented", 501, "The room day view is implemented by ticket #2.")


@router.get("/rooms/{room_id}/bookings", response_model=list[BookingRead])
def room_day(
    room_id: int,
    day: str,
    db: Session = Depends(get_db),
) -> list[BookingRead]:
    _not_implemented()
