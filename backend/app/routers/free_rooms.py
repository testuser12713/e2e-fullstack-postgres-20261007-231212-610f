"""Free-room search (stub until ticket #6 fills it)."""

from __future__ import annotations

from typing import NoReturn

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.errors import AppError
from app.schemas import RoomRead

router = APIRouter(prefix="/api", tags=["free-rooms"])


def _not_implemented() -> NoReturn:
    raise AppError("not_implemented", 501, "The free-room search is implemented by ticket #6.")


@router.get("/free-rooms", response_model=list[RoomRead])
def free_rooms(
    start: str,
    end: str,
    min_seats: int,
    db: Session = Depends(get_db),
) -> list[RoomRead]:
    _not_implemented()
