# Backcat

**Your back catalog, answering.**

A creator with 300 hours of episodes is sitting on a knowledge base nobody can search. Backcat turns that catalog into three assets:

1. **A cited Q&A layer** — fans ask anything; answers are grounded in the creator's actual words, cited to the exact second, with player deep links.
2. **A knowledge graph** the creator owns — every concept, person, and resource they've ever covered, with provenance on every edge.
3. **A content-gap report** — generated from the questions the catalog *couldn't* answer.

Built in public. Architecture, eval numbers, costs, and failures are all published — including the embarrassing ones, of which this README contains several.

## How it works

YouTube channel or RSS feed → audio (yt-dlp) → Whisper large-v3-turbo on Groq with word timestamps → time-aligned chunks (**30–45s windows, 10s overlap**, config-driven — the timestamp IS the product) → pgvector embeddings + Haiku concept extraction into Neo4j with per-edge provenance → hybrid retrieval (dense + BM25 + graph, RRF-fused, optional cross-encoder rerank) → Claude Sonnet, grounded-only, streaming cited answers.

Full design: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · Decisions: [docs/DECISIONS.md](docs/DECISIONS.md) · Extension: [docs/EXTENSION.md](docs/EXTENSION.md)

## Measured, not vibed

Retrieval quality, 88 golden questions, one catalog ([`eval/`](eval/)):

| config | hit@5 | MRR | recall@5 |
|---|---|---|---|
| baseline (dense + BM25, RRF) | 0.841 | 0.604 | 0.594 |
| baseline + rerank | 0.955 | 0.797 | 0.771 |
| graph (dense + BM25 + graph) | 0.818 | 0.631 | 0.683 |
| **graph + rerank** | **0.977** | **0.823** | **0.811** |

The graph channel *lowers* hit@5 on its own and pays only in recall on multi-hop (0.381 → 0.581) and temporal (0.517 → 0.800) questions. The cross-encoder does the rest. Caveats are real and stated in `eval/README.md` — read them before quoting these numbers.

Unit costs, all metered from `cost_events` rather than estimated:

| Stage | Measured |
|---|---|
| ASR (Whisper large-v3-turbo, Groq) | $0.04 / audio-hour |
| Concept extraction (Haiku, ~5-min windows) | $0.05–0.07 / audio-hour |
| Embeddings (`text-embedding-3-small`) | ~$0.0002 / audio-hour |
| Answering (Sonnet, top-6 chunks) | ~$0.014 / answer |

Corpus behind those figures — one catalog, queried live from the database rather than quoted from a build log: **15 episodes, 198 chunks, 1.86 audio-hours, 286 graph entities** (178 concepts, 55 categories, 28 resources, 25 people). Total API spend across the whole project is **$0.77** by `SELECT sum(cost_usd) FROM cost_events`, of which $0.37 is concept extraction, $0.22 Whisper, and $0.13 generating the golden set.

## Monorepo

| Dir | What | Stack | Runs where |
|---|---|---|---|
| `web/` | Landing + admin dashboard | Next.js + TypeScript | Vercel (landing) · compose |
| `ext/` | Chrome MV3 side panel + YouTube content script | Preact · Vite | Loaded unpacked; not published |
| `serve/` | Query API (SSE streaming) + JWT auth | FastAPI | compose |
| `pipeline/` | Ingestion → transcripts → chunks → embeddings → graph | Python ≥3.10 | compose (`worker`) |
| `eval/` | Golden-set harness + benchmark runner | Python | local |
| `infra/` | Keycloak realm export, yt-dlp cookie-jar setup notes | — | — |
| `docs/` | Architecture, decision log, extension design | — | — |

**Deployment reality:** `docs/ARCHITECTURE.md` specifies Vercel + Railway. What actually runs today is the full Docker Compose stack on a **single AWS EC2 host**, addressed by `PUBLIC_HOST` in the repo-root `.env`. The architecture doc has not been updated to match.

## Status

Sprint day 1 was 2026-07-19. Days 1–4 ran as planned and landed most of the early build, then the project went silent for 16 days and came back in bursts: 46 commits across 9 active days out of 29 calendar days. The build half is largely done; the marketing half of the plan has not started.

**Working end to end:** ingestion (RSS + YouTube via yt-dlp), Whisper transcription with word timestamps, time-aligned chunking, pgvector embeddings, Haiku concept extraction into Neo4j, three-channel hybrid retrieval, cross-encoder reranking, streaming cited answers over SSE, honest-absence at $0 spend, per-job progress logs with retry and zombie-job reclaim, Keycloak auth, admin dashboard, Chrome extension, eval harness with a scored benchmark.

**Not done:** no caption fast-path, no multi-turn, no billing, no public demo, no users.

## Known gaps

Kept here rather than in a private tracker, because a project whose whole claim is "measured" should publish what it hasn't measured.

- **The reranker is off by default.** `retrieval.use_reranker` is `False` in `pipeline/src/backcat_pipeline/config.py`, so the shipped configuration is the 0.818 row above — below the 0.85 bar in `docs/ARCHITECTURE.md`. Flipping it is one `app_config` row.
- **The keyword channel stems Persian text with the English dictionary.** `to_tsvector('english', text)` in `pipeline/migrations/002_chunks.sql`, with a comment claiming the golden set is English. It isn't. The BM25 baseline is therefore weaker than it should be, which flatters the reranker in the table above.
- **Channel RSS only exposes ~15 recent videos**, so a product named for back catalogs currently cannot see the back catalog. The uploads-playlist endpoint or the OAuth connector fixes this.
- **No caption fast-path.** Everything goes through Whisper, so first value costs a full transcription pass. Auto-captions would make a whole channel indexable in seconds.
- **YouTube audio download depends on a hand-maintained cookie jar** (`infra/yt-dlp/`) because datacenter IPs hit the bot wall. This sits uncomfortably against the creator-authorized principle and needs replacing.
- **No backups are implemented.** `docs/ARCHITECTURE.md` §7 specifies a nightly `pg_dump`; no such job exists in this repo, and local Docker data has already been lost once.
- **No alias canonicalization** — concepts merge by exact name only, so near-duplicates will accumulate on larger catalogs.
- **No tests.**

## Local dev

```sh
docker compose up -d
```

That is the whole stack: Postgres+pgvector (5432), Neo4j (7474/7687), Keycloak (8080), the query API (8000), the ingestion worker, and the dashboard (3000). Migrations and Neo4j constraints apply automatically on the worker's startup.

These are **built images, not hot-reloading dev servers** — after a code change, `docker compose up -d --build <service>`. For fast iteration on one service, run it on the host instead (`npm run dev` in `web/`, `uvicorn backcat_serve.main:app --reload` in `serve/`) and leave the rest on Docker.

Two env files before anything will run:

- **Root `.env`** — copy `.env.development.example` (local) or `.env.production.example` (EC2). Sets `PUBLIC_HOST`, from which compose derives the web, Keycloak, and serve URLs.
- **`pipeline/.env`** — the real secrets (`GROQ_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`), read by `serve` and `worker` through compose `env_file`. There is no `pipeline/.env.example` yet; the keys it needs are the ones documented in the root `.env.example`.

Neither is committed, and neither is baked into the images.
