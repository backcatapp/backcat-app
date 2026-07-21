"""Backcat query API.

SSE streamed directly to the browser (day-3 decision: no Next.js proxy hop).
Guardrails live here beside the retrieval stack: per-IP rate limit (Postgres),
kill-switch + daily spend cap (app_config), every question logged.

SSE protocol on POST /api/catalogs/{id}/ask:
  event: sources  data: [{"i", "episode", "start_s", "end_s"}]
  event: delta    data: {"text": "..."}
  event: done     data: {"answered": true}
  event: absence  data: {"message": "..."}
  event: error    data: {"message": "...", "code": 429|503|500}
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

app = FastAPI(title="backcat-serve")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in os.environ.get("CORS_ORIGIN", "http://localhost:3000").split(",")],
    allow_methods=["POST", "GET"],
    allow_headers=["content-type"],
)


class AskBody(BaseModel):
    question: str = Field(min_length=3, max_length=1000)


def _sse(event: str, data) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


@app.get("/healthz")
def healthz():
    return {"ok": True}


# Internal endpoints: called server-to-server by the dashboard's Server Actions
# (which enforce the admin role). Shared-token gate, never exposed to browsers.
INTERNAL_TOKEN = os.environ.get("INTERNAL_TOKEN", "dev-internal-token")


class ChannelBody(BaseModel):
    url: str = Field(min_length=2, max_length=300)


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

    def gen():
        with connect() as conn:
            row = conn.execute("SELECT id FROM catalogs WHERE id = %s", (catalog_id,)).fetchone()
            if row is None:
                yield _sse("error", {"message": "catalog not found", "code": 404})
                return

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

            question_id = log_question(
                conn, catalog_id=catalog_id, question=body.question,
                answered=covered, confidence=confidence, ip=ip,
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
            try:
                answer_gen = stream_answer(
                    conn, catalog_id=catalog_id, query=body.question, hits=hits
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
            yield _sse("done", {"answered": True})

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
