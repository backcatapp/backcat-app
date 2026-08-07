# Backcat

Backcat turns a creator's entire back catalog (podcast/YouTube) into cited answers and a living map of their ideas. Fans ask questions; answers are grounded in the creator's actual words, cited to `[episode, mm:ss]`, with player deep links. Currently in a 30-day build-in-public sprint.

## Monorepo layout

- `web/` — Next.js + TypeScript on Vercel. Landing page + (day 11+) chat UI and concept map explorer.
- `serve/` — FastAPI query API on Railway. Runs the full query path; streams SSE **direct to the browser** (no Next.js proxy). Rate limiting + daily spend kill-switch live here.
- `pipeline/` — Python (≥3.10) ingestion: RSS → Whisper (Groq) → time-aligned chunks → embeddings (pgvector) → LLM extraction → Neo4j. Plain CLIs; job state = rows in Postgres (no queue framework).
- `eval/` — golden-set eval harness (hit@5, MRR, per-category). Open-sourced day 14. **Quality gate: nothing fan-facing ships if the harness regresses.**
- `docs/` — `ARCHITECTURE.md` (system design — read before touching pipeline/serve) and `DECISIONS.md` (decision log — check before re-debating anything).

## Source of truth

Product docs live in the Obsidian vault at `G:\Obsidian\MyNet\10 Projects\Backcat\` (architecture, features, sprint plan, build log, decision log). `docs/` here mirrors the architecture + decisions; when they conflict, the vault wins — update both.

## Non-negotiable product principles

1. **Grounded-only answers** — every factual claim cites a retrieved chunk; no chunk, no claim.
2. **Honest absence** — if the catalog doesn't cover it, say so and log the question (feeds gap nodes). Never fake coverage.
3. **The timestamp IS the product** — chunks are time windows (30–45s default, config-driven), never character counts; provenance `(episode_id, start_ts)` on every graph edge.
4. **Measured, not vibed** — retrieval changes are judged by the eval harness, not by eyeballing answers.
5. **Creator-authorized only** — no scraping; RSS/OAuth/upload paths only.

## Conventions

- Pipeline writes are idempotent: deterministic chunk IDs (`hash(episode_id, start_ts)`), Postgres `ON CONFLICT` upserts, Neo4j `MERGE`. Never plain INSERT/CREATE.
- Every table and graph node carries `catalog_id` (multi-catalog from day 1; multi-tenant auth comes in v1.0).
- Cost logging is mandatory on every LLM/ASR call — per-episode and per-catalog costs feed the public build log.
- Web: App Router + Server Actions (no public API routes for form writes); server components by default.
- Secrets via env only; `.env` is gitignored, keep `.env.example` current.

## Local dev

- `docker compose up -d` — the whole stack: Postgres+pgvector (5432), Neo4j (7474/7687), Keycloak (8080), the query API (`serve/`, 8000), the ingestion worker, and the dashboard (`web/`, 3000). One command, no separate `npm run dev` / `uvicorn` terminals needed.
- These are **built** images, not hot-reloading dev servers — after a code change, `docker compose up -d --build <service>` to pick it up. For fast iteration on one service, run it directly on the host instead (`npm run dev` in `web/`; `uvicorn backcat_serve.main:app --reload` in `serve/`) while leaving the rest on Docker.
- First run (or after a full reset): migrations and Neo4j constraints apply automatically via the `worker` service's startup command — no manual `migrate` step needed.
- Real secrets (`GROQ_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`) live in `pipeline/.env`, consumed by `serve`/`worker` via compose `env_file`; web's own secrets live in `web/.env.local`. Neither is baked into the images.

## Sprint workflow

After a working session that ships something, use the `build-log` skill to record what shipped (with real, verified numbers) in the vault Build Log and tick the sprint checkboxes. Never invent numbers — `[bracketed]` figures are placeholders to replace with measured reality.
