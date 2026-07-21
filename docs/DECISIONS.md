# Decision Log

One line per decision, newest on top. If you find yourself re-debating something, check here first. (Mirror of the vault decision log — vault is the source of truth.)

| Date | Decision | Why |
|---|---|---|
| Day 7 | **Skip golden set/eval harness for now** (revisit before graph work); build creator self-serve instead: YouTube channel connector via **channel RSS** (auto-resolved, ~15 recent videos, no API key) + per-episode selective transcription from the dashboard + `ingest worker` poll loop | Creator flow validated earlier; measured-not-vibed still gates the graph — harness debt logged, not forgiven |
| Day 7 | Dashboard→pipeline execution model: buttons write job rows (Server Actions), **`ingest worker`** polls and processes — still no queue framework; channel-add via token-gated serve internal endpoint keeps Python the single ingestion brain | UI actions live without Celery/Redis; det_id mirrored in TS |
| Day 6 | Fan identity strategy: **anonymous sessions first** (localStorage session_key, multi-turn at day 11), Keycloak `fan` accounts in v1.0 link sessions on first login | Login wall before first answer kills fan conversion; identity must buy the fan something, not be a toll booth |
| Day 6 | Chunk windows shortened **60–90s → 30–45s** (10s overlap), config-driven via `app_config`; re-chunk = one re-index, cents per catalog | Player seeked to chunk start must land near the cited claim (±15s bar); UX beat theory; day-7 eval validates answer quality; extraction cost ~2x chunks — revisit before day 8 |
| Day 5 | YouTube ingestion: **start with yt-dlp** (manual pull → `ingest add-local`, own/permitted content only), migrate to official OAuth path (captions + upload) in v1.0 | Official Data API can't download audio even with OAuth; unblocks testing now; creator-authorized principle still governs the hosted product path |
| Day 4 | Auth = **Keycloak** (roles `admin/creator/fan`), pulled forward from v1.0; web integrates via an Auth.js middleware seam so the provider stays swappable; runs in local Docker with a **committed realm export** (no console clicking), Railway only when the panel must be public | Authorities requirement = real roles; `serve/` later validates the same JWTs via JWKS; the seam caps blast radius if Keycloak ops eat sprint time |
| Day 4 | Config authority = DB-backed **`app_config`** + minimal admin panel from day 4, superseding "env-only until v1.0"; precedence is **DB value → env fallback** everywhere (Python + web) | Spend caps, kill-switch, model/embedding switches, and ingestion controls become clickable without redeploys; creator-facing full admin panel stays v1.0 |
| Day 3 | Query path served by **FastAPI `serve/`** on Railway; browser gets SSE **direct** (single CORS origin, no Next.js proxy); per-IP rate limit in Postgres + **daily spend kill-switch** on the public demo | No Vercel streaming hop/timeouts; guardrails live beside the Python retrieval stack; unauthenticated Sonnet endpoint needs a budget fuse |
| Day 3 | App tables named day 1: `sessions` `messages` `questions` (+`unanswered` flag) `guardrail_events`, all with `catalog_id` | Chat, gap nodes, guardrail logging land day 11–12 without schema improvisation |
| Day 3 | Deterministic chunk IDs (`hash(episode_id, start_ts)`) + upsert/`MERGE` semantics everywhere | Re-index and re-runs idempotent; no duplicate rows/nodes in Postgres or Neo4j |
| Day 3 | Concept map served from **precomputed CDN-cached JSON snapshot** per catalog, not live Neo4j | Meets ≤3s @ 3k nodes; share page survives Neo4j hiccups; cheaper |
| Day 3 | Nightly `pg_dump` to object storage; job rows **are** the DLQ (attempt count + `failed` state) | Transcripts are the costliest artifact to regenerate; still no queue framework |
| Day 3 | Pipeline + eval in **Python**; web stays TypeScript | AI-ecosystem tooling; open-sourced eval harness reads credibly in Python |
| Day 3 | Embeddings **provider-switchable**: OpenAI 3-small default, self-hosted bge-m3 fallback; per-model vector columns, switch = re-embed via re-index | Vendor hedge + multilingual later; config-based until admin panel (v1.0) |
| Day 3 | Extraction = **own prompts** + Haiku-class structured output; NOT neo4j-graphrag's pipeline | Provenance-per-edge schema + prompt library is IP (open-sourced day 14) |
| Day 3 | Answering = **Claude Sonnet**, streaming + prompt caching | Citation discipline is the signature; don't save pennies before evals prove it safe |
| Day 3 | **Railway** hosts Postgres+pgvector AND Neo4j; AuraDB Free = fallback if ops eat sprint time | One platform for product data; we own Neo4j backups/memory |
| Day 3 | One **monorepo** (`web/ serve/ pipeline/ eval/ docs/`); landing moves in | One CI, clean eval/ carve-out for day-14 open-source |
| Day 3 | Orchestration = plain Python CLIs + job rows in Postgres, no queue framework | Status page reads job rows; queues are post-sprint complexity |
| Day 2 | Waitlist writes via **Server Action**, not a public API route; RLS on with zero policies | No endpoint to discover; DB key never reaches the browser; deny-by-default |
| Day 0 | Graph-native from day 1 (Neo4j alongside pgvector) | Graph is the differentiator; benchmark proves where it pays |
| Day 0 | RSS-first ingestion; creator-authorized only, no scraping | Legal posture + zero-effort onboarding + positioning |
| Day 0 | Chunk by time (60–90s windows), not characters | The timestamp IS the product |
| Day 0 | Eval harness before graph work; open-source it | Measured-not-vibed principle; credibility asset |
