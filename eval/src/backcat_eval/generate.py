"""Golden-set generation (day 10): every question is phrased by an LLM, but
every ground-truth chunk_id comes straight from the database/graph — the LLM
never invents provenance, it only reads real excerpts and asks a question
they answer. Questions are generated in the transcript's own language.

Four categories, each with a mechanically-derived ground truth:
  single_fact  - one random chunk; answerable from it alone.
  aggregation  - a concept mentioned across >=2 episodes; ground truth is the
                 full set of chunks fed to the model (recall@k shows whether
                 a channel retrieves the FULL set, not just one).
  multi_hop    - two entities that co-occur AND each have independent
                 mentions elsewhere; ground truth spans the co-occurrence
                 chunk(s) plus each entity's standalone chunk(s).
  temporal     - a recurring entity's chronologically FIRST episode
                 (by real published_at); ground truth is that episode's
                 mention chunks only.
"""

import json
import random

import anthropic as anthropic_sdk

from backcat_pipeline.config import get_config, settings
from backcat_pipeline.costs import ensure_spend_allowed, log_cost
from backcat_pipeline.graph import cooccurring_pairs, entity_mention_chunks, recurring_entities

_SCHEMA = {
    "type": "object",
    "properties": {"question": {"type": "string"}},
    "required": ["question"],
    "additionalProperties": False,
}


def _ts(seconds: float) -> str:
    m, s = divmod(int(seconds), 60)
    return f"{m}:{s:02d}"


def _ask_llm(conn, client, model: str, rate_in: float, rate_out: float, prompt: str) -> str | None:
    est = (len(prompt) / 4 + 200) / 1_000_000 * rate_in + 100 / 1_000_000 * rate_out
    ensure_spend_allowed(conn, est)
    resp = client.messages.create(
        model=model,
        max_tokens=300,
        output_config={"format": {"type": "json_schema", "schema": _SCHEMA}},
        messages=[{"role": "user", "content": prompt}],
    )
    log_cost(
        conn, catalog_id=None, episode_id=None, service="anthropic_eval_gen", model=model,
        units=resp.usage.input_tokens + resp.usage.output_tokens, unit_kind="tokens",
        cost_usd=(resp.usage.input_tokens * rate_in + resp.usage.output_tokens * rate_out) / 1_000_000,
    )
    if resp.stop_reason == "max_tokens":
        return None
    data = json.loads(next(b.text for b in resp.content if b.type == "text"))
    q = data.get("question", "").strip()
    return q or None


def _chunk_rows(conn, chunk_ids: list[str]) -> dict:
    if not chunk_ids:
        return {}
    rows = conn.execute(
        "SELECT c.id, c.episode_id, e.title, c.start_s, c.end_s, c.text "
        "FROM chunks c JOIN episodes e ON e.id = c.episode_id WHERE c.id = ANY(%s)",
        (chunk_ids,),
    ).fetchall()
    return {r[0]: {"episode_id": r[1], "title": r[2], "start_s": float(r[3]), "end_s": float(r[4]), "text": r[5]} for r in rows}


def generate_single_fact(conn, client, model, rate_in, rate_out, catalog_id: str, n: int, seed: random.Random) -> list[dict]:
    rows = conn.execute(
        "SELECT id FROM chunks WHERE catalog_id = %s AND length(text) > 200", (catalog_id,)
    ).fetchall()
    ids = [r[0] for r in rows]
    seed.shuffle(ids)
    out = []
    for chunk_id in ids[: n * 2]:
        if len(out) >= n:
            break
        info = _chunk_rows(conn, [chunk_id])[chunk_id]
        prompt = (
            f"This is one excerpt from an episode transcript ({info['title']}, "
            f"{_ts(info['start_s'])}-{_ts(info['end_s'])}):\n\n{info['text']}\n\n"
            "Write ONE specific factual question that this excerpt alone answers. "
            "Write the question in the SAME language as the excerpt. Do not reference "
            "\"the excerpt\" or \"the speaker\" — phrase it like a fan asking the creator's assistant."
        )
        q = _ask_llm(conn, client, model, rate_in, rate_out, prompt)
        if not q:
            continue
        out.append({
            "id": f"sf_{chunk_id}",
            "category": "single_fact",
            "question": q,
            "relevant_chunk_ids": [chunk_id],
            "source": {"episode_ids": [info["episode_id"]], "entity_uids": []},
        })
    return out


def generate_aggregation(conn, client, model, rate_in, rate_out, catalog_id: str, n: int, seed: random.Random) -> list[dict]:
    entities = recurring_entities(catalog_id, min_episodes=2, min_mentions=2, limit=100)
    seed.shuffle(entities)
    out = []
    for ent in entities[:n]:
        mentions = entity_mention_chunks(ent["uid"], limit=8)
        chunk_ids = [m["chunk_id"] for m in mentions]
        rows = _chunk_rows(conn, chunk_ids)
        if len(rows) < 2:
            continue
        excerpts = "\n\n".join(
            f"[{i}] ({rows[cid]['title']} · {_ts(rows[cid]['start_s'])}) {rows[cid]['text']}"
            for i, cid in enumerate(rows, 1)
        )
        prompt = (
            f"The creator discussed \"{ent['name']}\" across {ent['episodes']} different episodes. "
            f"Excerpts:\n\n{excerpts}\n\n"
            "Write ONE aggregation-style question a fan might ask that can only be answered well by "
            f"combining points from MULTIPLE of these episodes (e.g. \"what has the creator said about "
            f"{ent['name']} over time / across episodes\"). Write it in the SAME language as the excerpts."
        )
        q = _ask_llm(conn, client, model, rate_in, rate_out, prompt)
        if not q:
            continue
        out.append({
            "id": f"ag_{ent['uid']}",
            "category": "aggregation",
            "question": q,
            "relevant_chunk_ids": list(rows.keys()),
            "source": {"episode_ids": sorted({r["episode_id"] for r in rows.values()}), "entity_uids": [ent["uid"]]},
        })
    return out


def generate_multi_hop(conn, client, model, rate_in, rate_out, catalog_id: str, n: int, seed: random.Random) -> list[dict]:
    pairs = cooccurring_pairs(catalog_id, limit=200)
    seed.shuffle(pairs)
    out = []
    used_uids: set[str] = set()
    for p in pairs:
        if len(out) >= n:
            break
        # spread across distinct entities rather than reusing the same hub node repeatedly
        if p["a_uid"] in used_uids and p["b_uid"] in used_uids:
            continue
        chunk_ids = p["shared_chunks"] + p["a_only_chunks"] + p["b_only_chunks"]
        rows = _chunk_rows(conn, chunk_ids)
        if len(rows) < 2:
            continue
        excerpts = "\n\n".join(
            f"[{i}] ({rows[cid]['title']} · {_ts(rows[cid]['start_s'])}) {rows[cid]['text']}"
            for i, cid in enumerate(rows, 1)
        )
        prompt = (
            f"These excerpts connect two things the creator discusses: \"{p['a_name']}\" and \"{p['b_name']}\".\n\n"
            f"{excerpts}\n\n"
            f"Write ONE question that requires connecting \"{p['a_name']}\" and \"{p['b_name']}\" to answer "
            "(a fan couldn't answer it from a passage about only one of them). "
            "Write it in the SAME language as the excerpts."
        )
        q = _ask_llm(conn, client, model, rate_in, rate_out, prompt)
        if not q:
            continue
        used_uids.add(p["a_uid"])
        used_uids.add(p["b_uid"])
        out.append({
            "id": f"mh_{p['a_uid']}__{p['b_uid']}",
            "category": "multi_hop",
            "question": q,
            "relevant_chunk_ids": list(rows.keys()),
            "source": {"episode_ids": sorted({r["episode_id"] for r in rows.values()}), "entity_uids": [p["a_uid"], p["b_uid"]]},
        })
    return out


def generate_temporal(conn, client, model, rate_in, rate_out, catalog_id: str, n: int, seed: random.Random) -> list[dict]:
    entities = recurring_entities(catalog_id, min_episodes=2, min_mentions=2, limit=100)
    seed.shuffle(entities)
    out = []
    for ent in entities[:n]:
        mentions = entity_mention_chunks(ent["uid"], limit=20)
        ep_ids = sorted({m["episode_id"] for m in mentions})
        ep_rows = conn.execute(
            "SELECT id, title, published_at FROM episodes WHERE id = ANY(%s) ORDER BY published_at NULLS LAST",
            (ep_ids,),
        ).fetchall()
        ep_rows = [r for r in ep_rows if r[2] is not None]
        if len(ep_rows) < 2:
            continue
        first_ep = ep_rows[0]
        gt_chunks = [m["chunk_id"] for m in mentions if m["episode_id"] == first_ep[0]]
        if not gt_chunks:
            continue
        other_titles = ", ".join(r[1] for r in ep_rows[1:4])
        prompt = (
            f"The creator discussed \"{ent['name']}\" in several episodes, including one titled "
            f"\"{first_ep[1]}\" (the chronologically FIRST one to mention it) and later ones such as: "
            f"{other_titles}.\n\n"
            f"Write ONE question asking which episode first covered \"{ent['name']}\", or what the creator "
            f"originally said about it before revisiting it later — phrased as a fan would ask, without "
            "naming the episode title in the question itself. Write it in the SAME language as the episode titles."
        )
        q = _ask_llm(conn, client, model, rate_in, rate_out, prompt)
        if not q:
            continue
        out.append({
            "id": f"tm_{ent['uid']}",
            "category": "temporal",
            "question": q,
            "relevant_chunk_ids": gt_chunks,
            "source": {"episode_ids": [first_ep[0]], "entity_uids": [ent["uid"]]},
        })
    return out


def generate_golden_set(
    conn, *, catalog_id: str, n_single_fact: int, n_aggregation: int, n_multi_hop: int, n_temporal: int,
    seed: int = 42,
) -> list[dict]:
    if not settings.anthropic_api_key:
        raise RuntimeError("ANTHROPIC_API_KEY is not set — add it to pipeline/.env")
    model = str(get_config(conn, "model.extraction"))  # Haiku-class — cheap, this is generation not answering
    rate_in = float(get_config(conn, "extraction_usd_per_mtok_in"))
    rate_out = float(get_config(conn, "extraction_usd_per_mtok_out"))
    client = anthropic_sdk.Anthropic(api_key=settings.anthropic_api_key)
    rnd = random.Random(seed)

    questions = []
    questions += generate_single_fact(conn, client, model, rate_in, rate_out, catalog_id, n_single_fact, rnd)
    questions += generate_aggregation(conn, client, model, rate_in, rate_out, catalog_id, n_aggregation, rnd)
    questions += generate_multi_hop(conn, client, model, rate_in, rate_out, catalog_id, n_multi_hop, rnd)
    questions += generate_temporal(conn, client, model, rate_in, rate_out, catalog_id, n_temporal, rnd)
    for q in questions:
        q["catalog_id"] = catalog_id
    return questions
