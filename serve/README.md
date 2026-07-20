# serve/

FastAPI query API (Railway). Runs the full query path — rewrite → dense + BM25 + graph retrieval → RRF → rerank → Claude Sonnet, grounded-only — and streams SSE **directly to the browser** (single CORS origin, no Next.js proxy).

Also home to: per-IP rate limiting (Postgres counter), the global daily spend kill-switch for the public demo, and guardrail-event logging.

Built from day 6 (retrieval) onward; API surface lands with the chat UI (day 11). See `docs/ARCHITECTURE.md` §4.
