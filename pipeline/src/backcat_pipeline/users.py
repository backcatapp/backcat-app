"""User identity, usage wallet, and BYOK helpers for the extension surface.

Daily free asks → extra_credits → BYOK Anthropic key → 402 QuotaExceeded.
BYOK keys are Fernet-encrypted with BYOK_SECRET; never returned to clients.
"""

from __future__ import annotations

import os
from dataclasses import dataclass

from cryptography.fernet import Fernet, InvalidToken

from .config import get_config


class QuotaExceeded(Exception):
    """No free asks left, no credits, and no BYOK — client should show upgrade UI."""


@dataclass
class AskDebit:
    """How this ask will be paid for."""

    mode: str  # "free" | "credit" | "byok"
    api_key: str | None  # Anthropic key when mode == "byok"


# Fixed 32-byte url-safe key for local/dev when BYOK_SECRET is unset.
# Production MUST set BYOK_SECRET (Fernet.generate_key()).
_DEV_BYOK_SECRET = "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY="


def _fernet() -> Fernet:
    secret = os.environ.get("BYOK_SECRET", "").strip() or _DEV_BYOK_SECRET
    return Fernet(secret.encode())


def encrypt_byok(plaintext: str) -> str:
    return _fernet().encrypt(plaintext.encode()).decode()


def decrypt_byok(ciphertext: str) -> str:
    try:
        return _fernet().decrypt(ciphertext.encode()).decode()
    except InvalidToken as exc:
        raise ValueError("could not decrypt BYOK key — check BYOK_SECRET") from exc


def upsert_user(conn, *, user_id: str, email: str, display_name: str | None = None) -> None:
    conn.execute(
        """
        INSERT INTO users (id, email, display_name)
        VALUES (%s, %s, %s)
        ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            display_name = COALESCE(EXCLUDED.display_name, users.display_name),
            updated_at = now()
        """,
        (user_id, email, display_name),
    )


def questions_today(conn, user_id: str) -> int:
    return conn.execute(
        "SELECT count(*) FROM questions WHERE user_id = %s "
        "AND created_at >= date_trunc('day', now())",
        (user_id,),
    ).fetchone()[0]


def profile(conn, user_id: str) -> dict:
    row = conn.execute(
        "SELECT email, display_name, extra_credits, byok_last4 FROM users WHERE id = %s",
        (user_id,),
    ).fetchone()
    if row is None:
        raise LookupError(f"user {user_id} not found")
    daily_cap = int(get_config(conn, "rate_limit.questions_per_user_per_day") or 10)
    used = questions_today(conn, user_id)
    free_left = max(0, daily_cap - used)
    return {
        "id": user_id,
        "email": row[0],
        "display_name": row[1],
        "extra_credits": row[2],
        "byok_configured": row[3] is not None,
        "byok_last4": row[3],
        "daily_cap": daily_cap,
        "asks_today": used,
        "free_left": free_left,
    }


def set_display_name(conn, user_id: str, display_name: str) -> None:
    conn.execute(
        "UPDATE users SET display_name = %s, updated_at = now() WHERE id = %s",
        (display_name.strip() or None, user_id),
    )


def set_byok(conn, user_id: str, api_key: str) -> str:
    key = api_key.strip()
    if len(key) < 20:
        raise ValueError("API key looks too short")
    last4 = key[-4:]
    enc = encrypt_byok(key)
    conn.execute(
        "UPDATE users SET byok_anthropic_enc = %s, byok_last4 = %s, updated_at = now() "
        "WHERE id = %s",
        (enc, last4, user_id),
    )
    return last4


def clear_byok(conn, user_id: str) -> None:
    conn.execute(
        "UPDATE users SET byok_anthropic_enc = NULL, byok_last4 = NULL, updated_at = now() "
        "WHERE id = %s",
        (user_id,),
    )


def debit_ask(conn, user_id: str, *, commit_credit: bool = True) -> AskDebit:
    """Decide how to pay for this ask.

    When commit_credit=False, only probe (no credit decrement) — used to
    fail-fast with QuotaExceeded before retrieval. Call again with
    commit_credit=True once an LLM answer will actually run.
    """
    daily_cap = int(get_config(conn, "rate_limit.questions_per_user_per_day") or 10)
    used = questions_today(conn, user_id)
    row = conn.execute(
        "SELECT extra_credits, byok_anthropic_enc FROM users WHERE id = %s FOR UPDATE",
        (user_id,),
    ).fetchone()
    if row is None:
        raise LookupError(f"user {user_id} not found")
    credits, byok_enc = row

    if used < daily_cap:
        return AskDebit(mode="free", api_key=None)

    if credits > 0:
        if commit_credit:
            conn.execute(
                "UPDATE users SET extra_credits = extra_credits - 1, updated_at = now() "
                "WHERE id = %s AND extra_credits > 0",
                (user_id,),
            )
        return AskDebit(mode="credit", api_key=None)

    if byok_enc:
        return AskDebit(mode="byok", api_key=decrypt_byok(byok_enc))

    raise QuotaExceeded(
        "Daily free asks used up. Add an Anthropic API key or buy more credits."
    )


def link_catalog(conn, user_id: str, catalog_id: str, kind: str) -> None:
    if kind not in ("owned", "saved"):
        raise ValueError(f"bad kind {kind}")
    conn.execute(
        """
        INSERT INTO user_catalogs (user_id, catalog_id, kind)
        VALUES (%s, %s, %s)
        ON CONFLICT DO NOTHING
        """,
        (user_id, catalog_id, kind),
    )


def unlink_saved(conn, user_id: str, catalog_id: str) -> None:
    conn.execute(
        "DELETE FROM user_catalogs WHERE user_id = %s AND catalog_id = %s AND kind = 'saved'",
        (user_id, catalog_id),
    )


def list_catalogs(conn, user_id: str) -> list[dict]:
    rows = conn.execute(
        """
        SELECT c.id, c.name, c.rss_url, c.paused,
               array_agg(DISTINCT uc.kind ORDER BY uc.kind) AS kinds,
               (SELECT count(*) FROM episodes e WHERE e.catalog_id = c.id) AS episodes,
               (SELECT count(*) FROM chunks ch WHERE ch.catalog_id = c.id) AS chunks
        FROM user_catalogs uc
        JOIN catalogs c ON c.id = uc.catalog_id
        WHERE uc.user_id = %s
        GROUP BY c.id
        ORDER BY max(uc.created_at) DESC
        """,
        (user_id,),
    ).fetchall()
    return [
        {
            "id": r[0],
            "name": r[1],
            "rss_url": r[2],
            "paused": r[3],
            "kinds": list(r[4] or []),
            "episodes": r[5],
            "chunks": r[6],
            "indexed": r[6] > 0,
        }
        for r in rows
    ]


def user_has_catalog(conn, user_id: str, catalog_id: str) -> bool:
    row = conn.execute(
        "SELECT 1 FROM user_catalogs WHERE user_id = %s AND catalog_id = %s LIMIT 1",
        (user_id, catalog_id),
    ).fetchone()
    return row is not None


def list_catalog_episodes(conn, user_id: str, catalog_id: str) -> list[dict] | None:
    """Episodes for a catalog the user owns/saved. None if no access."""
    if not user_has_catalog(conn, user_id, catalog_id):
        return None
    rows = conn.execute(
        """
        SELECT e.id, e.title, e.source_url, e.published_at, e.guid,
               EXISTS (
                   SELECT 1 FROM chunks ch WHERE ch.episode_id = e.id
               ) AS indexed,
               EXISTS (
                   SELECT 1 FROM jobs j
                   WHERE j.episode_id = e.id AND j.status IN ('queued', 'running')
               ) AS indexing
        FROM episodes e
        WHERE e.catalog_id = %s
        ORDER BY e.published_at DESC NULLS LAST, e.title
        """,
        (catalog_id,),
    ).fetchall()
    return [
        {
            "id": r[0],
            "title": r[1],
            "source_url": r[2],
            "published_at": r[3].isoformat() if r[3] else None,
            "youtube_id": r[4],
            "indexed": bool(r[5]),
            "indexing": bool(r[6]),
        }
        for r in rows
    ]


STAGES = ("download", "transcribe", "chunk", "embed", "graph")


def queue_episode_index(conn, user_id: str, episode_id: str) -> dict:
    """Queue full pipeline for an episode the user owns/saved. Idempotent."""
    from .ids import det_id

    row = conn.execute(
        "SELECT e.catalog_id, e.title FROM episodes e WHERE e.id = %s",
        (episode_id,),
    ).fetchone()
    if row is None:
        raise LookupError("episode not found")
    catalog_id, title = row
    if not user_has_catalog(conn, user_id, catalog_id):
        raise PermissionError("catalog not linked to user")

    queued = 0
    for stage in STAGES:
        cur = conn.execute(
            """
            INSERT INTO jobs (id, catalog_id, episode_id, stage)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (episode_id, stage) DO NOTHING
            """,
            (det_id(episode_id, stage), catalog_id, episode_id, stage),
        )
        queued += cur.rowcount or 0
    # If jobs already existed as failed/done, re-queue missing stages only via
    # ON CONFLICT DO NOTHING — for re-index of failed, bump failed→queued:
    conn.execute(
        """
        UPDATE jobs SET status = 'queued', attempt_count = 0, error = NULL
        WHERE episode_id = %s AND status = 'failed'
        """,
        (episode_id,),
    )
    return {
        "episode_id": episode_id,
        "catalog_id": catalog_id,
        "title": title,
        "queued_new": queued,
        "status": "indexing",
    }
