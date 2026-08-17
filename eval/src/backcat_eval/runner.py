"""Benchmark runner (day 10): each golden question is retrieved ONCE per
channel (dense/keyword/graph), then re-fused locally into four configs —
this way the benchmark doesn't re-pay embedding costs per config.

Configs:
  baseline         - dense + keyword (pre-day-9 retrieval)
  baseline+rerank  - baseline pool, cross-encoder reranked
  graph            - dense + keyword + graph (current default)
  graph+rerank     - graph pool, cross-encoder reranked
"""

from backcat_pipeline.retrieval import Hit, dense_search, graph_search, keyword_search, rrf_fuse

from .metrics import hit_at_k, recall_at_k, reciprocal_rank

CONFIGS = ("baseline", "baseline+rerank", "graph", "graph+rerank")


def _ids(hits: list[Hit]) -> list[str]:
    return [h.chunk_id for h in hits]


def evaluate_question(conn, question: dict, *, k: int = 5, rerank_pool: int = 30) -> dict:
    from backcat_pipeline.rerank import score_pairs

    catalog_id = question["catalog_id"]
    query = question["question"]
    relevant = set(question["relevant_chunk_ids"])

    dense = dense_search(conn, catalog_id, query, k=rerank_pool)
    keyword = keyword_search(conn, catalog_id, query, k=rerank_pool)
    graph = graph_search(conn, catalog_id, query, k=rerank_pool)

    baseline_pool = rrf_fuse({"dense": dense, "keyword": keyword}, k=rerank_pool)
    graph_pool = rrf_fuse({"dense": dense, "keyword": keyword, "graph": graph}, k=rerank_pool)

    # One cross-encoder pass over the union — the two pools overlap heavily, and
    # a chunk must score identically wherever it appears.
    scores = score_pairs(query, baseline_pool + graph_pool)

    def reranked(pool: list[Hit]) -> list[str]:
        return [h.chunk_id for h in sorted(pool, key=lambda h: scores[h.chunk_id], reverse=True)[:k]]

    ranked_ids = {
        "baseline": _ids(baseline_pool[:k]),
        "baseline+rerank": reranked(baseline_pool),
        "graph": _ids(graph_pool[:k]),
        "graph+rerank": reranked(graph_pool),
    }

    result = {
        "id": question["id"],
        "category": question["category"],
        "scored": len(scores),
        # What each config actually returned, and the candidate pool behind it.
        # Kept so a change of ground truth (human judgments) can rescore this run
        # arithmetically instead of re-paying 40 minutes of cross-encoder time.
        "ranked_ids": ranked_ids,
        "pool_ids": sorted(set(_ids(baseline_pool)) | set(_ids(graph_pool))),
    }
    for name, ids in ranked_ids.items():
        result[name] = {
            "hit@k": hit_at_k(ids, relevant, k),
            "mrr": reciprocal_rank(ids, relevant),
            "recall@k": recall_at_k(ids, relevant, k),
        }
    return result


def run_benchmark(conn, golden_set: list[dict], *, k: int = 5, rerank_pool: int = 30) -> list[dict]:
    import time

    results = []
    t0 = time.monotonic()
    for i, q in enumerate(golden_set, 1):
        results.append(evaluate_question(conn, q, k=k, rerank_pool=rerank_pool))
        rate = (time.monotonic() - t0) / i
        print(
            f"  [{i}/{len(golden_set)}] {q['category']:12s} "
            f"{rate:.1f}s/q · eta {rate * (len(golden_set) - i) / 60:.1f}min",
            flush=True,
        )
    return results


def summarize(results: list[dict]) -> dict:
    """Per-category, per-config mean metrics, plus an 'overall' row."""
    categories = sorted({r["category"] for r in results}) + ["overall"]
    summary: dict[str, dict] = {}
    for cat in categories:
        rows = results if cat == "overall" else [r for r in results if r["category"] == cat]
        if not rows:
            continue
        summary[cat] = {"n": len(rows)}
        for cfg in CONFIGS:
            summary[cat][cfg] = {
                "hit@k": sum(r[cfg]["hit@k"] for r in rows) / len(rows),
                "mrr": sum(r[cfg]["mrr"] for r in rows) / len(rows),
                "recall@k": sum(r[cfg]["recall@k"] for r in rows) / len(rows),
            }
    return summary
