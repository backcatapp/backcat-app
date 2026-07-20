# eval/

Golden-set eval harness. 100 Q&A pairs generated from transcripts (day 7), +50 aggregation/multi-hop/temporal questions (day 10). Metrics: hit@5, MRR, per-category breakdown — baseline hybrid RAG vs. graph-enhanced retrieval.

**This is the release gate:** nothing fan-facing ships if the harness regresses.

Open-sourced on day 14 together with the graph-extraction prompts. Starts day 7. See `docs/ARCHITECTURE.md` §4.
