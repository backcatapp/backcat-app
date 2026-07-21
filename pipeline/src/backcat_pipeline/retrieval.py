"""Hybrid retrieval (day 6): dense (pgvector) + keyword (tsvector) fused with RRF.

The graph channel joins on day 9. Every result carries (episode_id, start_s,
end_s) — retrieval never loses the timestamp.
"""

from dataclasses import dataclass, field

from .costs import ensure_spend_allowed, log_cost
from .embed import get_embedder

RRF_K = 60


@dataclass
class Hit:
    chunk_id: str
    episode_id: str
    episode_title: str
    start_s: float
    end_s: float
    text: str
    source_url: str | None = None
    channels: list[str] = field(default_factory=list)
    score: float = 0.0


_SELECT = """
    SELECT c.id, c.episode_id, e.title, c.start_s, c.end_s, c.text, e.source_url
"""


def dense_search(conn, catalog_id: str, query: str, k: int = 20) -> list[Hit]:
    provider = conn.execute(
        "SELECT embedding_provider FROM catalogs WHERE id = %s", (catalog_id,)
    ).fetchone()[0]
    embedder = get_embedder(conn, provider)
    est = (len(query) // 4 + 1) / 1_000_000 * embedder.usd_per_mtok
    ensure_spend_allowed(conn, est)
    vectors, tokens = embedder.embed([query])
    log_cost(
        conn, catalog_id=catalog_id, episode_id=None, service="openai_embed",
        model=embedder.model, units=tokens, unit_kind="tokens",
        cost_usd=tokens / 1_000_000 * embedder.usd_per_mtok,
    )
    vec = "[" + ",".join(f"{v:.7f}" for v in vectors[0]) + "]"
    rows = conn.execute(
        _SELECT
        + f"""
        , 1 - (emb.embedding <=> %s::vector) AS sim  -- noqa: sim must stay last
        FROM {embedder.table} emb
        JOIN chunks c ON c.id = emb.chunk_id
        JOIN episodes e ON e.id = c.episode_id
        WHERE c.catalog_id = %s
        ORDER BY emb.embedding <=> %s::vector
        LIMIT %s
        """,
        (vec, catalog_id, vec, k),
    ).fetchall()
    # score = cosine similarity — the honest-absence confidence signal
    return [
        Hit(r[0], r[1], r[2], float(r[3]), float(r[4]), r[5], r[6], score=float(r[7]))
        for r in rows
    ]


def keyword_search(conn, catalog_id: str, query: str, k: int = 20) -> list[Hit]:
    rows = conn.execute(
        _SELECT
        + """
        FROM chunks c
        JOIN episodes e ON e.id = c.episode_id
        WHERE c.catalog_id = %s AND c.tsv @@ websearch_to_tsquery('english', %s)
        ORDER BY ts_rank_cd(c.tsv, websearch_to_tsquery('english', %s)) DESC
        LIMIT %s
        """,
        (catalog_id, query, query, k),
    ).fetchall()
    return [Hit(r[0], r[1], r[2], float(r[3]), float(r[4]), r[5], r[6]) for r in rows]


def graph_search(conn, catalog_id: str, query: str, k: int = 20) -> list[Hit]:
    """Third channel (day 9): query-named entities -> their chunks via Neo4j.

    Degrades to empty on any graph failure — retrieval must not depend on
    Neo4j being up.
    """
    try:
        from .graph import graph_search_chunks

        scored = graph_search_chunks(catalog_id, query, k=k)
    except Exception:
        return []
    if not scored:
        return []
    ids = [c for c, _ in scored]
    rows = conn.execute(
        _SELECT + """
        FROM chunks c
        JOIN episodes e ON e.id = c.episode_id
        WHERE c.id = ANY(%s)
        """,
        (ids,),
    ).fetchall()
    by_id = {r[0]: r for r in rows}
    hits = []
    for chunk_id, score in scored:
        r = by_id.get(chunk_id)
        if r:
            hits.append(Hit(r[0], r[1], r[2], float(r[3]), float(r[4]), r[5], r[6], score=score))
    return hits


def rrf_fuse(channels: dict[str, list[Hit]], k: int = 6) -> list[Hit]:
    """Reciprocal-rank fusion. score = sum over channels of 1/(RRF_K + rank)."""
    fused: dict[str, Hit] = {}
    for name, hits in channels.items():
        for rank, hit in enumerate(hits, start=1):
            entry = fused.setdefault(hit.chunk_id, Hit(**{**hit.__dict__, "channels": [], "score": 0.0}))
            entry.score += 1.0 / (RRF_K + rank)
            entry.channels.append(name)
    return sorted(fused.values(), key=lambda h: h.score, reverse=True)[:k]


def hybrid_search(conn, catalog_id: str, query: str, k: int = 6) -> list[Hit]:
    return rrf_fuse(
        {
            "dense": dense_search(conn, catalog_id, query),
            "keyword": keyword_search(conn, catalog_id, query),
            "graph": graph_search(conn, catalog_id, query),
        },
        k=k,
    )
