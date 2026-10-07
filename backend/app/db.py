"""Database engine, session factory and the FastAPI session dependency.

The engine is created lazily so importing this module never touches the
environment. Configuration is validated when the engine is first requested,
which happens at application startup.
"""

from __future__ import annotations

from collections.abc import Generator

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings


class Base(DeclarativeBase):
    """Typed declarative base for every ORM model of the product."""


_engine: Engine | None = None
_session_factory: sessionmaker[Session] | None = None


def normalize_database_url(database_url: str) -> str:
    """Force the declared psycopg (v3) driver.

    A plain ``postgresql://`` URL makes SQLAlchemy pick psycopg2, which this
    project does not declare. Rewriting it to ``postgresql+psycopg://`` selects
    the ``psycopg[binary]`` driver that is installed.
    """
    for prefix in ("postgresql://", "postgres://"):
        if database_url.startswith(prefix):
            return "postgresql+psycopg://" + database_url[len(prefix) :]
    return database_url


def get_engine() -> Engine:
    """Return the process-wide engine, creating it on first use."""
    global _engine
    if _engine is None:
        database_url = normalize_database_url(get_settings().require_database())
        _engine = create_engine(database_url, pool_pre_ping=True, future=True)
    return _engine


def get_session_factory() -> sessionmaker[Session]:
    """Return the process-wide session factory, creating it on first use."""
    global _session_factory
    if _session_factory is None:
        _session_factory = sessionmaker(bind=get_engine(), autoflush=False, expire_on_commit=False)
    return _session_factory


def get_db() -> Generator[Session]:
    """FastAPI dependency yielding a database session."""
    session = get_session_factory()()
    try:
        yield session
    finally:
        session.close()
