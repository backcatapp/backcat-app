# pipeline/

Python ingestion + indexing CLIs: RSS parse → audio download → batched Whisper (Groq, word timestamps) → time-aligned chunks (60–90s, 15s overlap) → embeddings (pgvector) → LLM extraction → alias canonicalization → Neo4j load.

Rules that apply to every stage (see `CLAUDE.md`):

- Idempotent writes only — deterministic chunk IDs, `ON CONFLICT` upserts, Neo4j `MERGE`.
- Job state = rows in Postgres (`queued → transcribing → chunking → embedding → graphing → live`, attempt counts, `failed` terminal state). No queue framework.
- Cost + duration logged per episode on every ASR/LLM call.

Starts day 4. See `docs/ARCHITECTURE.md` §1–3.
