"""Per-job progress logging, visible live in the dashboard Jobs page.

Uses its own short autocommit connection per line so progress is visible
mid-job (the stage's main transaction only commits at the end). Log volume
is a handful of lines per job — connection cost is irrelevant here.
"""

import contextvars
from datetime import datetime, timezone

import psycopg

from .config import settings

_current: contextvars.ContextVar[str | None] = contextvars.ContextVar("job_id", default=None)


def set_current(job_id: str | None) -> None:
    _current.set(job_id)


def log(msg: str) -> None:
    job_id = _current.get()
    if not job_id:
        return
    line = f"[{datetime.now(timezone.utc).strftime('%H:%M:%S')}] {msg}\n"
    try:
        with psycopg.connect(settings.database_url, autocommit=True) as conn:
            conn.execute(
                "UPDATE jobs SET logs = coalesce(logs, '') || %s WHERE id = %s", (line, job_id)
            )
    except Exception:
        pass  # logging must never break the stage
