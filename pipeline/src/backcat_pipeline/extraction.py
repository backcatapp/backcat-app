"""LLM extraction (graph stage): chunks -> concepts/people/resources -> Neo4j.

Chunks are grouped into ~5-minute windows per LLM call (the day-6 cost note:
don't pay per-chunk calls on 30-45s chunks). Structured JSON output, cost
logged per call, spend guard before every call. Concept names stay in the
content's language — the graph speaks the creator's language.
"""

import anthropic as anthropic_sdk

from .config import get_config, settings
from .costs import ensure_spend_allowed, log_cost
from .graph import sync_episode, write_extraction

WINDOW_CHUNKS = 8  # ~5-6 min of transcript per extraction call

_SCHEMA = {
    "type": "object",
    "properties": {
        "entities": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "type": {"type": "string", "enum": ["concept", "person", "resource"]},
                    "chunks": {"type": "array", "items": {"type": "integer"}},
                },
                "required": ["name", "type", "chunks"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["entities"],
    "additionalProperties": False,
}

_PROMPT = """Extract the distinct topics/concepts, people, and resources (books, tools, studies, works) genuinely discussed in this transcript window from one episode.

Rules:
- 3-10 entities per window; only things actually discussed, not passing words.
- name: concise (1-4 words), in the SAME LANGUAGE as the transcript.
- type: "concept" (idea/topic), "person" (named human), "resource" (book/tool/study/work).
- chunks: the [n] indices where the entity is substantively mentioned.
- Reuse identical names for the same entity across chunks.

Transcript window:
{window}"""


def _ts(seconds: float) -> str:
    m, s = divmod(int(seconds), 60)
    return f"{m}:{s:02d}"


def extract_episode(conn, *, catalog_id: str, episode_id: str) -> tuple[int, int]:
    """Extract entities for one episode and write them to Neo4j.

    Returns (n_entities, total_tokens)."""
    if not settings.anthropic_api_key:
        raise RuntimeError("ANTHROPIC_API_KEY is not set — add it to pipeline/.env")

    chunks = conn.execute(
        "SELECT id, start_s, end_s, text FROM chunks WHERE episode_id = %s ORDER BY start_s",
        (episode_id,),
    ).fetchall()
    if not chunks:
        raise RuntimeError("no chunks yet — chunk stage must run first")

    sync_episode(conn, catalog_id=catalog_id, episode_id=episode_id)

    model = str(get_config(conn, "model.extraction"))
    rate_in = float(get_config(conn, "extraction_usd_per_mtok_in"))
    rate_out = float(get_config(conn, "extraction_usd_per_mtok_out"))
    client = anthropic_sdk.Anthropic(api_key=settings.anthropic_api_key)

    mentions: dict[tuple[str, str], set[str]] = {}
    total_tokens = 0
    for w in range(0, len(chunks), WINDOW_CHUNKS):
        window = chunks[w : w + WINDOW_CHUNKS]
        text = "\n\n".join(
            f"[{i}] ({_ts(float(c[1]))}-{_ts(float(c[2]))}) {c[3]}" for i, c in enumerate(window)
        )
        est = (len(text) / 4 + 500) / 1_000_000 * rate_in + 600 / 1_000_000 * rate_out
        ensure_spend_allowed(conn, est)
        resp = client.messages.create(
            model=model,
            max_tokens=1500,
            output_config={"format": {"type": "json_schema", "schema": _SCHEMA}},
            messages=[{"role": "user", "content": _PROMPT.format(window=text)}],
        )
        import json

        data = json.loads(next(b.text for b in resp.content if b.type == "text"))
        for ent in data.get("entities", []):
            key = (ent["name"].strip(), ent["type"])
            if not key[0]:
                continue
            ids = mentions.setdefault(key, set())
            for idx in ent["chunks"]:
                if 0 <= idx < len(window):
                    ids.add(window[idx][0])
        total_tokens += resp.usage.input_tokens + resp.usage.output_tokens
        log_cost(
            conn, catalog_id=catalog_id, episode_id=episode_id, service="anthropic_extract",
            model=model, units=resp.usage.input_tokens + resp.usage.output_tokens,
            unit_kind="tokens",
            cost_usd=(resp.usage.input_tokens * rate_in + resp.usage.output_tokens * rate_out)
            / 1_000_000,
        )

    chunk_starts = {c[0]: float(c[1]) for c in chunks}
    n = write_extraction(
        catalog_id=catalog_id, episode_id=episode_id, mentions=mentions,
        chunk_starts=chunk_starts,
    )
    return n, total_tokens
