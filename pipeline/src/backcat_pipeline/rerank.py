"""Cross-encoder reranker (day 10).

Vendor choice per docs/ARCHITECTURE.md: "Cohere or bge, final pick day 10,
decided by golden-set numbers." No COHERE_API_KEY has ever been configured
for this project, so Cohere was never actually measurable here — bge is the
only reranker this repo can honestly benchmark, not a preference call.
bge-reranker-v2-m3 is multilingual (the catalog is Persian) and runs local
and free on CPU, at the cost of a ~1GB model download on first use.

Lazy singleton: the model loads once per process, not per query.
"""

from .retrieval import Hit

_model = None


def _get_model():
    global _model
    if _model is None:
        from sentence_transformers import CrossEncoder

        _model = CrossEncoder("BAAI/bge-reranker-v2-m3")
    return _model


def score_pairs(query: str, hits: list[Hit]) -> dict[str, float]:
    """chunk_id -> cross-encoder relevance score, each chunk scored once.

    Split out from rerank() because the eval harness compares configs whose
    candidate pools overlap: scoring the union once is ~2x faster than
    reranking each pool separately, and guarantees a chunk gets the same
    score in every config it appears in.
    """
    unique = {h.chunk_id: h for h in hits}
    if not unique:
        return {}
    model = _get_model()
    ids = list(unique)
    scores = model.predict([(query, unique[cid].text) for cid in ids])
    return {cid: float(s) for cid, s in zip(ids, scores)}


def rerank(query: str, hits: list[Hit], top_k: int = 6) -> list[Hit]:
    """Re-score a candidate pool with a cross-encoder and return the top_k.

    Cross-encoders score (query, passage) jointly — more accurate than the
    bi-encoder/BM25/graph scores that produced the pool, too slow to run over
    a whole catalog, which is why it sits after fusion, not before.
    """
    if not hits:
        return hits
    scores = score_pairs(query, hits)
    ranked = sorted(hits, key=lambda h: scores[h.chunk_id], reverse=True)
    return [
        Hit(**{**h.__dict__, "channels": h.channels + ["rerank"], "score": scores[h.chunk_id]})
        for h in ranked[:top_k]
    ]
