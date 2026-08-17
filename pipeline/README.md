# pipeline/

Python ingestion + indexing CLIs: RSS/YouTube parse → audio download (yt-dlp) → batched Whisper (Groq, word timestamps) → time-aligned chunks (30–45s, 10s overlap, config-driven) → embeddings (pgvector) → LLM extraction → Neo4j load.

Rules that apply to every stage (see `CLAUDE.md`):

- Idempotent writes only — deterministic chunk IDs, `ON CONFLICT` upserts, Neo4j `MERGE`.
- Job state = rows in Postgres (`queued → transcribing → chunking → embedding → graphing → live`, attempt counts, `failed` terminal state). No queue framework.
- Cost + duration logged per episode on every ASR/LLM call.

Not yet built: alias canonicalization (entities merge on exact name only, so near-duplicates accumulate) and a caption fast-path (every episode pays for a full Whisper pass).

See `docs/ARCHITECTURE.md` §1–3.
