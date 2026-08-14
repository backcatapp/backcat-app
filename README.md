# Backcat

**Your back catalog, answering.**

A creator with 300 hours of episodes is sitting on a knowledge base nobody can search. Backcat turns that catalog into three assets:

1. **A cited Q&A layer** — fans ask anything; answers are grounded in the creator's actual words, cited to the exact second, with player deep links.
2. **A knowledge graph** the creator owns — every concept, person, and resource they've ever covered, with provenance on every edge.
3. **A content-gap report** — generated from the questions the catalog *couldn't* answer.

Being built in public in a 30-day sprint. Follow along for architecture, eval numbers, costs, and failures — including the embarrassing ones.

## How it works

RSS → Whisper (word timestamps) → time-aligned chunks (60–90s, the timestamp IS the product) → hybrid retrieval (dense + BM25 + knowledge-graph traversal, RRF-fused, reranked) → Claude, grounded-only, streaming cited answers.

Full design: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · Decisions: [docs/DECISIONS.md](docs/DECISIONS.md)

## Monorepo

| Dir | What | Stack |
|---|---|---|
| `web/` | Landing + admin dashboard | Next.js + TypeScript · Vercel |
| `ext/` | Fan/creator product surface (Chrome MV3 side panel) | Preact · Vite |
| `serve/` | Query API (SSE streaming) + JWT auth | FastAPI · Railway |
| `pipeline/` | Ingestion → transcripts → chunks → embeddings → graph | Python · Railway |
| `eval/` | Golden-set eval harness (open-sourced day 14) | Python |
| `docs/` | Architecture + decision log + extension design | — |

## Sprint status

- ✅ Day 2 — landing live with waitlist
- ✅ Day 3 — architecture locked, monorepo scaffolded
- ⏳ Day 4 — ingestion pipeline (first real catalog, first real costs)
- Day 7 — eval baseline · Day 10 — GraphRAG vs. baseline benchmark · Day 13 — public demo · Day 14 — eval harness + extraction prompts open-sourced

## Local dev

```sh
docker compose up -d   # Postgres+pgvector :5432 · Neo4j :7474/:7687
cd web && npm install && npm run dev
```

Copy `.env.example` → `.env` and fill in keys before running the pipeline.
