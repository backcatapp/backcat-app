"""Human-judged ground truth.

The generated golden set takes `relevant_chunk_ids` from the same Neo4j traversal
the graph channel retrieves through, so graph configurations are partly scored
against their own index. A person reading the chunk against the question is the
only ground truth in this harness that no retrieval channel had a hand in.

Flow: `import-golden` loads the questions, `build-pool` turns a benchmark run into
a judging queue, the dashboard collects labels, `rescore` recomputes the metrics
from those labels — arithmetic over saved rankings, no retrieval re-run.
"""

import json
from typing import Any

from .metrics import hit_at_k, recall_at_k, reciprocal_rank
from .runner import CONFIGS

# Label vocabulary, mirrored in the dashboard UI.
NOT_RELEVANT, RELATED, ANSWERS = 0, 1, 2


def import_golden_set(conn, golden_set: list[dict]) -> int:
    for q in golden_set:
        conn.execute(
            """
            INSERT INTO eval_questions (id, catalog_id, category, question, generated_chunk_ids)
            VALUES (%s, %s, %s, %s, %s::jsonb)
            ON CONFLICT (id) DO UPDATE SET
                category = EXCLUDED.category,
                question = EXCLUDED.question,
                generated_chunk_ids = EXCLUDED.generated_chunk_ids
            """,
            (
                q["id"],
                q["catalog_id"],
                q["category"],
                q["question"],
                json.dumps(q["relevant_chunk_ids"]),
            ),
        )
    return len(golden_set)


def build_pool(conn, results: list[dict], golden_by_id: dict[str, dict], k: int = 5) -> int:
    """Pool = everything any configuration surfaced, plus the generated answer key.

    priority 1 is the union of the configs' top-k: those are the only chunks hit@k
    and MRR can see, so a run is fully scorable once priority 1 is judged. Priority 2
    is the rest of the RRF pool — judging it only sharpens recall.
    """
    rows: dict[tuple[str, str], dict[str, Any]] = {}

    def note(qid: str, cid: str, channel: str, rank: int, priority: int) -> None:
        key = (qid, cid)
        row = rows.setdefault(
            key, {"channels": set(), "best_rank": 999, "priority": 2, "catalog_id": None}
        )
        row["channels"].add(channel)
        row["best_rank"] = min(row["best_rank"], rank)
        row["priority"] = min(row["priority"], priority)

    for r in results:
        qid = r["id"]
        gold = golden_by_id.get(qid)
        if gold is None:
            continue
        for cfg in CONFIGS:
            for rank, cid in enumerate(r.get("ranked_ids", {}).get(cfg, [])[:k], start=1):
                note(qid, cid, cfg, rank, 1)
        for cid in r.get("pool_ids", []):
            note(qid, cid, "pool", 999, 2)
        for cid in gold["relevant_chunk_ids"]:
            note(qid, cid, "generated", 1, 1)
        for key in rows:
            if key[0] == qid:
                rows[key]["catalog_id"] = gold["catalog_id"]

    for (qid, cid), row in rows.items():
        conn.execute(
            """
            INSERT INTO eval_pool (question_id, chunk_id, catalog_id, channels, best_rank, priority)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (question_id, chunk_id) DO UPDATE SET
                channels = EXCLUDED.channels,
                best_rank = EXCLUDED.best_rank,
                priority = LEAST(eval_pool.priority, EXCLUDED.priority)
            """,
            (qid, cid, row["catalog_id"], sorted(row["channels"]), row["best_rank"], row["priority"]),
        )
    return len(rows)


def load_judgments(conn, threshold: int = ANSWERS) -> dict[str, set[str]]:
    """question_id -> chunks judged relevant at or above `threshold`."""
    rows = conn.execute(
        "SELECT question_id, chunk_id FROM eval_judgments WHERE label >= %s", (threshold,)
    ).fetchall()
    truth: dict[str, set[str]] = {}
    for qid, cid in rows:
        truth.setdefault(qid, set()).add(cid)
    return truth


def judged_questions(conn) -> set[str]:
    """Questions with at least one label — the only ones a human score may include.

    A question whose pool is entirely unjudged is not "no relevant chunks", it is
    "not looked at yet". Scoring it as a miss would silently punish every config.
    """
    rows = conn.execute("SELECT DISTINCT question_id FROM eval_judgments").fetchall()
    return {r[0] for r in rows}


def rescore(results: list[dict], truth: dict[str, set[str]], scorable: set[str], k: int = 5) -> list[dict]:
    out = []
    for r in results:
        if r["id"] not in scorable:
            continue
        relevant = truth.get(r["id"], set())
        rescored = {"id": r["id"], "category": r["category"], "n_relevant": len(relevant)}
        for cfg in CONFIGS:
            ids = r.get("ranked_ids", {}).get(cfg, [])
            rescored[cfg] = {
                "hit@k": hit_at_k(ids, relevant, k),
                "mrr": reciprocal_rank(ids, relevant),
                "recall@k": recall_at_k(ids, relevant, k),
            }
        out.append(rescored)
    return out


def agreement(conn) -> dict[str, int]:
    """How far the generated answer key was from the human one, where both exist."""
    row = conn.execute(
        """
        SELECT
          count(*) FILTER (WHERE j.label >= 2 AND g.is_generated) AS agreed_relevant,
          count(*) FILTER (WHERE j.label = 0 AND g.is_generated) AS generated_but_not_relevant,
          count(*) FILTER (WHERE j.label >= 2 AND NOT g.is_generated) AS relevant_but_missed,
          count(*) AS judged
        FROM eval_judgments j
        JOIN LATERAL (
            SELECT (q.generated_chunk_ids ? j.chunk_id) AS is_generated
            FROM eval_questions q WHERE q.id = j.question_id
        ) g ON TRUE
        """
    ).fetchone()
    return {
        "agreed_relevant": row[0],
        "generated_but_not_relevant": row[1],
        "relevant_but_missed": row[2],
        "judged": row[3],
    }
