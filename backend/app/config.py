"""Application configuration.

Configuration is read from the environment LAZILY (never at import time) and is
validated once at startup, so a process that is missing a required variable
refuses to start and names the variable instead of failing on the first request.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache

DEFAULT_OFFICE_TZ = "Europe/Berlin"


@dataclass(frozen=True)
class Settings:
    """Parsed environment configuration."""

    database_url: str
    test_database_url: str
    office_tz: str

    def require_database(self) -> str:
        """Return the database URL or refuse to continue, naming the variable."""
        if not self.database_url:
            raise RuntimeError(
                "DATABASE_URL is not set. It must point at the PostgreSQL instance, "
                "e.g. postgresql://app:app@localhost:5432/app — see RUN.json."
            )
        return self.database_url

    def test_url(self) -> str:
        """The database the test suite runs against (real PostgreSQL only)."""
        url = self.test_database_url or self.database_url
        if not url:
            raise RuntimeError(
                "Neither TEST_DATABASE_URL nor DATABASE_URL is set. The test suite needs a "
                "real PostgreSQL instance — see RUN.json."
            )
        return url


@lru_cache
def get_settings() -> Settings:
    """Build the settings object from the current environment (lazily, cached)."""
    return Settings(
        database_url=os.environ.get("DATABASE_URL", "").strip(),
        test_database_url=os.environ.get("TEST_DATABASE_URL", "").strip(),
        office_tz=(os.environ.get("OFFICE_TZ", "").strip() or DEFAULT_OFFICE_TZ),
    )


def validate_settings() -> Settings:
    """Touch every required setting once, at startup, so a missing one fails loudly."""
    settings = get_settings()
    settings.require_database()
    # office_tz always has a default, but make the object whole at startup anyway.
    _ = settings.office_tz
    return settings
