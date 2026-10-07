"""FastAPI application entry point for the room-booking API."""

from __future__ import annotations

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import models  # noqa: F401  (registers the tables on Base.metadata)
from app.config import validate_settings
from app.db import Base, get_engine
from app.errors import register_exception_handlers
from app.routers import bookings, free_rooms, room_day, rooms


@asynccontextmanager
async def lifespan(_app: FastAPI):
    validate_settings()
    Base.metadata.create_all(bind=get_engine())
    yield


app = FastAPI(title="Raumbuchung API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ.get("FRONTEND_ORIGIN", "http://localhost:5173")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_exception_handlers(app)


@app.get("/api/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok"}


# The four routers are included in this fixed order.
app.include_router(rooms.router)
app.include_router(bookings.router)
app.include_router(room_day.router)
app.include_router(free_rooms.router)
