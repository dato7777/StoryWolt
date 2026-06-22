"""PostgreSQL / Supabase connection helpers."""

from __future__ import annotations

import os
from contextlib import contextmanager
from typing import Any, Iterator


def is_db_configured() -> bool:
    return bool(_database_url())


def _database_url() -> str | None:
    return (
        os.environ.get("DATABASE_URL", "").strip()
        or os.environ.get("SUPABASE_DB_URL", "").strip()
        or None
    )


@contextmanager
def db_connection() -> Iterator[Any]:
    url = _database_url()
    if not url:
        raise RuntimeError(
            "Database not configured. Set DATABASE_URL (Supabase → Project Settings → Database)."
        )

    try:
        import psycopg2
        from psycopg2.extras import RealDictCursor
    except ImportError as exc:
        raise RuntimeError("psycopg2-binary is required for database access") from exc

    conn = psycopg2.connect(url, cursor_factory=RealDictCursor)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
