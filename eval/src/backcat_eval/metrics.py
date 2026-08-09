"""Retrieval metrics: hit@k, MRR, recall@k.

hit@k and MRR are the sprint's stated metrics (docs/ARCHITECTURE.md). recall@k
is added because aggregation questions have more than one relevant chunk —
hit@k only asks "did we get ANY of them," which can't show whether the graph
retrieves the fuller set.
"""


def hit_at_k(retrieved_ids: list[str], relevant: set[str], k: int) -> int:
    return int(any(cid in relevant for cid in retrieved_ids[:k]))


def reciprocal_rank(retrieved_ids: list[str], relevant: set[str]) -> float:
    for i, cid in enumerate(retrieved_ids, start=1):
        if cid in relevant:
            return 1.0 / i
    return 0.0


def recall_at_k(retrieved_ids: list[str], relevant: set[str], k: int) -> float:
    if not relevant:
        return 0.0
    return len(set(retrieved_ids[:k]) & relevant) / len(relevant)
