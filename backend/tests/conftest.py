"""Shared test fixtures.

The suite runs against a REAL PostgreSQL instance (never SQLite). The schema is
created and dropped around the session, and only the tables this product owns are
touched.
"""

from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app import models  # noqa: F401  (register the tables on Base.metadata)
from app.db import Base, get_db, normalize_database_url
from app.main import app


def database_url() -> str:
    """The PostgreSQL URL the tests run against."""
    url = (
        os.environ.get("TEST_DATABASE_URL", "").strip()
        or os.environ.get("DATABASE_URL", "").strip()
    )
    if not url:
        pytest.skip("TEST_DATABASE_URL/DATABASE_URL is not set — PostgreSQL is required.")
    return url


@pytest.fixture(scope="session")
def engine():
    eng = create_engine(normalize_database_url(database_url()), pool_pre_ping=True, future=True)
    if eng.dialect.name != "postgresql":
        eng.dispose()
        pytest.skip("The test suite requires a real PostgreSQL instance (no SQLite).")
    Base.metadata.drop_all(eng)
    Base.metadata.create_all(eng)
    try:
        yield eng
    finally:
        Base.metadata.drop_all(eng)
        eng.dispose()


@pytest.fixture
def db_session(engine):
    factory = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    session: Session = factory()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(engine, db_session):
    def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
