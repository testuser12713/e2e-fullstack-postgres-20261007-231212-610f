"""Rooms CRUD routes (stub until ticket #10 fills them).

Every route exists with its final signature and answers 501 with the uniform
error body until its owning ticket implements it.
"""

from __future__ import annotations

from typing import NoReturn

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.errors import AppError
from app.schemas import RoomCreate, RoomRead

router = APIRouter(prefix="/api", tags=["rooms"])


def _not_implemented() -> NoReturn:
    raise AppError("not_implemented", 501, "Rooms CRUD is implemented by ticket #10.")


@router.get("/rooms", response_model=list[RoomRead])
def list_rooms(db: Session = Depends(get_db)) -> list[RoomRead]:
    _not_implemented()


@router.post("/rooms", response_model=RoomRead, status_code=201)
def create_room(payload: RoomCreate, db: Session = Depends(get_db)) -> RoomRead:
    _not_implemented()


@router.get("/rooms/{room_id}", response_model=RoomRead)
def get_room(room_id: int, db: Session = Depends(get_db)) -> RoomRead:
    _not_implemented()


@router.put("/rooms/{room_id}", response_model=RoomRead)
def update_room(room_id: int, payload: RoomCreate, db: Session = Depends(get_db)) -> RoomRead:
    _not_implemented()


@router.delete("/rooms/{room_id}", status_code=204)
def delete_room(room_id: int, db: Session = Depends(get_db)) -> None:
    _not_implemented()
