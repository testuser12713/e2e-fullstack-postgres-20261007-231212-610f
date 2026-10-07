"""Pydantic v2 schemas shared by the API (the contract of the sprint)."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator


class ErrorBody(BaseModel):
    """The single uniform error body returned by every failing request."""

    code: str
    message: str
    fields: dict[str, str] | None = None


class RoomCreate(BaseModel):
    name: str
    seats: int
    amenities: list[str] = []


class RoomRead(RoomCreate):
    id: int

    model_config = ConfigDict(from_attributes=True)


class BookingCreate(BaseModel):
    room_id: int
    booked_by: str
    title: str
    start: datetime
    end: datetime

    @field_validator("start", "end")
    @classmethod
    def _require_timezone(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.tzinfo.utcoffset(value) is None:
            raise ValueError("timestamp must be timezone-aware (ISO-8601 with offset)")
        return value


class BookingRead(BaseModel):
    id: int
    room_id: int
    room_name: str
    booked_by: str
    title: str
    start: datetime
    end: datetime

    model_config = ConfigDict(from_attributes=True)
