# eval/

Golden-set retrieval harness. Generates questions from indexed transcripts, records the source chunk as ground truth, then scores retrieval configurations against them: **hit@k, MRR, recall@k**, overall and per category.

**This is the release gate:** nothing fan-facing ships if the harness regresses. See `docs/ARCHITECTURE.md` §4.

## The golden set

`golden_set.json` — **88 questions from a single catalog**, generated from its transcripts and hand-kept.

| category | n | what it tests |
|---|---|---|
| single_fact | 40 | one chunk contains the answer |
| multi_hop | 25 | answer spans chunks or episodes |
| aggregation | 13 | "how many times did they…" across the catalog |
| temporal | 10 | ordering, "before/after", "when did they first…" |

The questions are **in Persian**, matching the catalog.

## Running it

```sh
backcat-eval generate <catalog-id-or-name>   # questions from indexed chunks + graph
backcat-eval run                             # all 88 x 4 configs in one pass
backcat-eval report                          # per-category comparison table
```

`generate` defaults to requesting 40 single-fact, 30 multi-hop, 20 aggregation, 15 temporal. It produced 40/25/13/10 — the derived categories skip any candidate entity that doesn't appear in at least two chunks, so a small catalog yields fewer questions than requested. That is why the set is 88 and not 105.

`results/day10_benchmark.json` is the raw scored output; `results/day10_benchmark.md` is the generated table; `plot_benchmark.py` renders the two PNG charts from the JSON.

## Results (2026-08-08, n=88)

| config | hit@5 | MRR | recall@5 |
|---|---|---|---|
| baseline (dense + BM25, RRF) | 0.841 | 0.604 | 0.594 |
| baseline + rerank | 0.955 | 0.797 | 0.771 |
| graph (dense + BM25 + graph) | 0.818 | 0.631 | 0.683 |
| **graph + rerank** | **0.977** | **0.823** | **0.811** |

Headline: the graph channel *lowers* overall hit@5 on its own; the cross-encoder is worth roughly five times more. The graph earns its place only on the harder categories — multi-hop recall@5 0.381 → 0.581, temporal 0.517 → 0.800 — and graph+rerank is the only configuration to reach 1.00 hit@5 on multi-hop.

## Caveats — read before quoting these numbers

These are honest measurements of a narrow thing. They are not a general benchmark of GraphRAG.

1. **One catalog, one creator, one language.** All 88 questions come from a single catalog. Topic mix, speaking style, and episode length are held constant, and none of it generalizes without a second catalog.
2. **The keyword channel is misconfigured for this corpus.** Chunks are indexed with `to_tsvector('english', …)` (`pipeline/migrations/002_chunks.sql`) while the corpus and questions are Persian, so BM25 contributes far less than it should. That handicaps every configuration, and it inflates the reranker's apparent contribution relative to a correctly configured baseline.
3. **The ground truth is the chunk the question was generated from.** This measures "can retrieval find its way back to the source chunk," not "did the user get a good answer." A different chunk that answers the question equally well scores as a miss.
4. **Relevance is binary on chunk id, and chunks overlap by 10s.** An adjacent chunk containing the same sentence is scored wrong. Real precision is better than these numbers suggest.
5. **Single run, no confidence intervals.** At n=88, one question is 1.1 points. The headline baseline-vs-graph gap (0.841 → 0.818) is *two questions*. Treat small differences as noise.
6. **The per-category deltas rest on small n.** The temporal result quoted everywhere is 10 questions. Directional at best.
7. **Retrieval only.** Nothing here scores answer quality, citation correctness, or honest-absence behaviour — the parts a fan actually experiences.

## Status

Built and run. Not yet open-sourced as a standalone repo, and not yet wired into CI as an actual gate — today it is a gate by intention, run by hand.
