"""SQLAlchemy 2.0 models for rooms and bookings."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, func
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class Room(Base):
    __tablename__ = "rooms"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    seats: Mapped[int] = mapped_column(Integer, nullable=False)
    amenities: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False, default=list)

    bookings: Mapped[list[Booking]] = relationship(
        back_populates="room", cascade="all, delete-orphan"
    )

    __table_args__ = (
        # Case-insensitive uniqueness: a functional unique index on lower(name).
        Index("uq_rooms_name_lower", func.lower(name), unique=True),
    )


class Booking(Base):
    __tablename__ = "bookings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    room_id: Mapped[int] = mapped_column(
        ForeignKey("rooms.id", ondelete="CASCADE"), nullable=False, index=True
    )
    booked_by: Mapped[str] = mapped_column(String(255), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    room: Mapped[Room] = relationship(back_populates="bookings")
