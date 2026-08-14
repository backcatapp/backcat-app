"""Backcat query API.

SSE streamed directly to the browser (day-3 decision: no Next.js proxy hop).
Guardrails: per-IP rate limit (anonymous), per-user daily quota + credits + BYOK
(authenticated extension), kill-switch + daily spend cap (app_config).

SSE protocol on POST /api/catalogs/{id}/ask:
  event: sources  data: [{"i", "episode", "start_s", "end_s"}]
  event: delta    data: {"text": "..."}
  event: done     data: {"answered": true}
  event: absence  data: {"message": "..."}
  event: error    data: {"message": "...", "code": 402|429|503|500}
"""

import json
import os

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from backcat_pipeline.answering import log_question, record_answer, retrieve, stream_answer
from backcat_pipeline.config import get_config
from backcat_pipeline.costs import SpendBlocked
from backcat_pipeline.db import connect
from backcat_pipeline.users import (
    QuotaExceeded,
    clear_byok,
    debit_ask,
    link_catalog,
    list_catalog_episodes,
    list_catalogs,
    log_user_event,
    profile,
    queue_episode_index,
    request_credits,
    set_byok,
    set_display_name,
    unlink_saved,
    upsert_user,
)

from .auth import AuthUser, optional_user, require_user

app = FastAPI(title="backcat-serve")

_cors_origins = [o.strip() for o in os.environ.get("CORS_ORIGIN", "http://localhost:3000").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_origin_regex=r"chrome-extension://.*",
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["content-type", "authorization"],
)


class AskBody(BaseModel):
    question: str = Field(min_length=3, max_length=1000)


class ProfileBody(BaseModel):
    display_name: str = Field(min_length=1, max_length=120)


class ByokBody(BaseModel):
    api_key: str = Field(min_length=20, max_length=200)


class ChannelBody(BaseModel):
    url: str = Field(min_length=2, max_length=300)


def _sse(event: str, data) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


def _ensure_user_row(conn, user: AuthUser) -> None:
    upsert_user(conn, user_id=user.id, email=user.email or user.id, display_name=user.display_name)


@app.get("/healthz")
def healthz():
    return {"ok": True}


@app.get("/api/me")
def me(request: Request):
    user = require_user(request)
    with connect() as conn:
        _ensure_user_row(conn, user)
        conn.commit()
        return profile(conn, user.id)


@app.put("/api/me")
def update_me(body: ProfileBody, request: Request):
    user = require_user(request)
    with connect() as conn:
        _ensure_user_row(conn, user)
        set_display_name(conn, user.id, body.display_name)
        conn.commit()
        return profile(conn, user.id)


@app.put("/api/me/byok")
def put_byok(body: ByokBody, request: Request):
    user = require_user(request)
    with connect() as conn:
        _ensure_user_row(conn, user)
        try:
            last4 = set_byok(conn, user.id, body.api_key)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        conn.commit()
        return {"byok_configured": True, "byok_last4": last4}


@app.delete("/api/me/byok")
def delete_byok(request: Request):
    user = require_user(request)
    with connect() as conn:
        _ensure_user_row(conn, user)
        clear_byok(conn, user.id)
        conn.commit()
    return {"byok_configured": False}


@app.get("/api/me/catalogs")
def my_catalogs(request: Request):
    user = require_user(request)
    with connect() as conn:
        _ensure_user_row(conn, user)
        conn.commit()
        return {"catalogs": list_catalogs(conn, user.id)}


@app.get("/api/me/catalogs/{catalog_id}/episodes")
def my_catalog_episodes(catalog_id: str, request: Request):
    """List episodes for a catalog the user owns or saved."""
    user = require_user(request)
    with connect() as conn:
        _ensure_user_row(conn, user)
        conn.commit()
        episodes = list_catalog_episodes(conn, user.id, catalog_id)
    if episodes is None:
        raise HTTPException(status_code=404, detail="catalog not found or not linked")
    return {"catalog_id": catalog_id, "episodes": episodes}


@app.post("/api/me/episodes/{episode_id}/index")
def index_my_episode(episode_id: str, request: Request):
    """Queue download→graph for an episode the user owns/saved (Whisper spends $)."""
    user = require_user(request)
    with connect() as conn:
        _ensure_user_row(conn, user)
        try:
            result = queue_episode_index(conn, user.id, episode_id)
        except LookupError:
            raise HTTPException(status_code=404, detail="episode not found") from None
        except PermissionError:
            raise HTTPException(status_code=403, detail="save this channel first") from None
        conn.commit()
    return result


@app.post("/api/me/catalogs")
def add_my_catalog(body: ChannelBody, request: Request):
    """Add a YouTube channel (RSS list only — no Whisper jobs) and mark owned+saved."""
    user = require_user(request)
    from backcat_pipeline.youtube import add_channel

    with connect() as conn:
        _ensure_user_row(conn, user)
        try:
            catalog_id, name, n = add_channel(conn, body.url)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        link_catalog(conn, user.id, catalog_id, "owned")
        link_catalog(conn, user.id, catalog_id, "saved")
        conn.commit()
        return {"catalog_id": catalog_id, "name": name, "episodes": n, "indexed": False}


@app.post("/api/me/catalogs/{catalog_id}/save")
def save_catalog(catalog_id: str, request: Request):
    user = require_user(request)
    with connect() as conn:
        _ensure_user_row(conn, user)
        row = conn.execute("SELECT id FROM catalogs WHERE id = %s", (catalog_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="catalog not found")
        link_catalog(conn, user.id, catalog_id, "saved")
        conn.commit()
    return {"saved": True, "catalog_id": catalog_id}


@app.delete("/api/me/catalogs/{catalog_id}/save")
def unsave_catalog(catalog_id: str, request: Request):
    user = require_user(request)
    with connect() as conn:
        _ensure_user_row(conn, user)
        unlink_saved(conn, user.id, catalog_id)
        conn.commit()
    return {"saved": False, "catalog_id": catalog_id}


class CreditRequestBody(BaseModel):
    note: str | None = Field(default=None, max_length=500)


@app.post("/api/me/credit-request")
def credit_request(request: Request, body: CreditRequestBody = CreditRequestBody()):
    """Ask us to contact you about buying credits (no self-serve checkout)."""
    user = require_user(request)
    with connect() as conn:
        _ensure_user_row(conn, user)
        result = request_credits(conn, email=user.email, user_id=user.id, note=body.note)
        conn.commit()
    return {
        "ok": True,
        "message": f"Thanks — we'll contact you at {user.email} to arrange credits.",
        **result,
    }


@app.get("/api/videos/{youtube_id}")
def video_lookup(youtube_id: str, request: Request):
    """Map a YouTube video id → catalog/episode if listed in any catalog.

    Always returns indexed status (has chunks). With Bearer, also returns
    saved/owned relative to the signed-in user.
    """
    if not youtube_id or len(youtube_id) > 32:
        raise HTTPException(status_code=422, detail="bad video id")
    auth = optional_user(request)
    with connect() as conn:
        row = conn.execute(
            """
            SELECT e.id, e.catalog_id, c.name, e.title,
                   EXISTS (
                       SELECT 1 FROM chunks ch WHERE ch.episode_id = e.id
                   ) AS indexed,
                   EXISTS (
                       SELECT 1 FROM jobs j
                       WHERE j.episode_id = e.id AND j.status IN ('queued', 'running')
                   ) AS indexing
            FROM episodes e
            JOIN catalogs c ON c.id = e.catalog_id
            WHERE e.source_url LIKE %s OR e.guid = %s OR e.audio_url = %s
            LIMIT 1
            """,
            (f"%{youtube_id}%", youtube_id, f"youtube:{youtube_id}"),
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="video not in any catalog")
        out = {
            "episode_id": row[0],
            "catalog_id": row[1],
            "catalog_name": row[2],
            "episode_title": row[3],
            "indexed": bool(row[4]),
            "indexing": bool(row[5]),
        }
        if auth is not None:
            _ensure_user_row(conn, auth)
            kinds = conn.execute(
                "SELECT kind FROM user_catalogs WHERE user_id = %s AND catalog_id = %s",
                (auth.id, row[1]),
            ).fetchall()
            kind_set = {k[0] for k in kinds}
            out["saved"] = "saved" in kind_set
            out["owned"] = "owned" in kind_set
            out["linked"] = bool(kind_set)
            conn.commit()
    return out


@app.get("/api/catalogs/{catalog_id}/graph")
def catalog_graph_endpoint(catalog_id: str, limit: int = 120, episode_id: str | None = None):
    """Concept graph for visualization: entities + co-occurrence links.

    Pass episode_id to scope to one video (YouTube watch panel / Graph tab).
    """
    from backcat_pipeline.graph import catalog_graph

    try:
        return catalog_graph(
            catalog_id, limit=min(limit, 300), episode_id=episode_id or None
        )
    except Exception:
        raise HTTPException(status_code=503, detail="graph unavailable")


@app.get("/api/concepts/chunks")
def concept_chunks_endpoint(uid: str, episode_id: str | None = None):
    """Moments (chunks) related to a selected graph node, with text + player URLs."""
    from backcat_pipeline.graph import concept_chunks

    try:
        rows = concept_chunks(uid, episode_id=episode_id or None)
    except Exception:
        raise HTTPException(status_code=503, detail="graph unavailable")
    if not rows:
        return {"moments": []}
    ids = [r["chunk_id"] for r in rows]
    with connect() as conn:
        db_rows = conn.execute(
            """
            SELECT c.id, e.title, e.source_url, c.start_s, c.end_s, c.text
            FROM chunks c JOIN episodes e ON e.id = c.episode_id
            WHERE c.id = ANY(%s)
            ORDER BY e.title, c.start_s
            """,
            (ids,),
        ).fetchall()
    return {
        "moments": [
            {
                "episode": r[1], "source_url": r[2], "start_s": float(r[3]),
                "end_s": float(r[4]), "text": r[5],
            }
            for r in db_rows
        ]
    }


@app.get("/api/episodes/{episode_id}/topics")
def episode_topics_endpoint(episode_id: str):
    """Per-episode topics with mention windows (timeline visualization)."""
    from backcat_pipeline.graph import episode_topics

    try:
        return episode_topics(episode_id)
    except Exception:
        raise HTTPException(status_code=503, detail="graph unavailable")


# Internal endpoints: called server-to-server by the dashboard's Server Actions
# (which enforce the admin role). Shared-token gate, never exposed to browsers.
INTERNAL_TOKEN = os.environ.get("INTERNAL_TOKEN", "dev-internal-token")


@app.post("/api/internal/channels")
def add_channel_endpoint(body: ChannelBody, request: Request):
    if request.headers.get("x-internal-token") != INTERNAL_TOKEN:
        raise HTTPException(status_code=401, detail="bad internal token")
    from backcat_pipeline.youtube import add_channel

    with connect() as conn:
        try:
            catalog_id, name, n = add_channel(conn, body.url)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc))
    return {"catalog_id": catalog_id, "name": name, "episodes": n}


@app.post("/api/catalogs/{catalog_id}/ask")
def ask(catalog_id: str, body: AskBody, request: Request):
    ip = request.client.host if request.client else None
    auth = optional_user(request)

    def gen():
        with connect() as conn:
            row = conn.execute("SELECT id FROM catalogs WHERE id = %s", (catalog_id,)).fetchone()
            if row is None:
                yield _sse("error", {"message": "catalog not found", "code": 404})
                return

            debit = None
            user_id = None
            if auth is not None:
                _ensure_user_row(conn, auth)
                user_id = auth.id
                # Pre-check quota (don't burn a credit yet — only when we stream).
                try:
                    debit = debit_ask(conn, user_id, commit_credit=False)
                except QuotaExceeded as exc:
                    log_user_event(
                        conn,
                        user_id=user_id,
                        email=auth.email,
                        event="quota_blocked",
                        props={"catalog_id": catalog_id},
                    )
                    conn.commit()
                    yield _sse("error", {"message": str(exc), "code": 402})
                    return
            else:
                limit = int(get_config(conn, "rate_limit.questions_per_hour"))
                recent = conn.execute(
                    "SELECT count(*) FROM questions WHERE ip = %s "
                    "AND created_at > now() - interval '1 hour'",
                    (ip,),
                ).fetchone()[0]
                if recent >= limit:
                    yield _sse("error", {"message": "rate limit reached — try again later", "code": 429})
                    return

            try:
                hits, confidence, covered = retrieve(
                    conn, catalog_id=catalog_id, query=body.question
                )
            except SpendBlocked:
                yield _sse("error", {"message": "temporarily unavailable", "code": 503})
                return

            # Burn a credit only when we will call the LLM (covered answer).
            if auth is not None and covered and debit and debit.mode == "credit":
                debit = debit_ask(conn, user_id, commit_credit=True)

            question_id = log_question(
                conn, catalog_id=catalog_id, question=body.question,
                answered=covered, confidence=confidence, ip=ip, user_id=user_id,
                debit_mode=debit.mode if debit else None,
            )
            if not covered:
                conn.commit()
                yield _sse(
                    "absence",
                    {"message": "This catalog doesn't cover that — the question has been logged for the creator."},
                )
                return

            yield _sse(
                "sources",
                [
                    {
                        "i": i,
                        "episode": h.episode_title,
                        "start_s": h.start_s,
                        "end_s": h.end_s,
                        "source_url": h.source_url,
                        "text": h.text,
                    }
                    for i, h in enumerate(hits, 1)
                ],
            )
            answer_parts: list[str] = []
            cost = None
            api_key = debit.api_key if debit else None
            try:
                answer_gen = stream_answer(
                    conn, catalog_id=catalog_id, query=body.question, hits=hits,
                    api_key=api_key,
                )
                while True:
                    part = next(answer_gen)
                    answer_parts.append(part)
                    yield _sse("delta", {"text": part})
            except StopIteration as done:
                _usage, cost = done.value
            except SpendBlocked:
                yield _sse("error", {"message": "temporarily unavailable", "code": 503})
                conn.commit()
                return
            record_answer(
                conn, question_id=question_id, answer="".join(answer_parts),
                hits=hits, cost_usd=cost,
            )
            conn.commit()
            yield _sse("done", {"answered": True, "debit": debit.mode if debit else "anon"})

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
