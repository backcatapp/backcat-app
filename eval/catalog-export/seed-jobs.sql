-- After load.sql: tell the worker what still has to be computed on this machine.
--
-- download/transcribe/chunk are marked done because load.sql already supplied
-- their output (the chunk rows) — re-running them would re-download audio and
-- re-transcribe at Groq for no gain, and a fresh transcript would produce
-- DIFFERENT chunk ids, which is exactly what breaks the golden set.
--
-- embed/graph are queued instead of copied:
--   embed  — OpenAI embeddings are deterministic for the same model + text, so
--            recomputing gives byte-identical vectors. ~$0.002 for this catalog.
--   graph  — LLM extraction is NOT deterministic, so this graph will differ
--            slightly from the source machine's. ~$0.14 for 1.86 audio hours.
--            The golden set stays valid either way: its relevant_chunk_ids point
--            at chunk rows, which load.sql reproduced exactly.
--
-- Job ids mirror backcat_pipeline.ids.det_id: first 16 hex chars of
-- sha256("<episode_id>|<stage>").
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f seed-jobs.sql

\set cid '6f2ef26393812d69'

INSERT INTO jobs (id, catalog_id, episode_id, stage, status, started_at, finished_at)
SELECT left(encode(sha256((e.id || '|' || s.stage)::bytea), 'hex'), 16),
       e.catalog_id, e.id, s.stage, 'done', now(), now()
FROM episodes e
CROSS JOIN (VALUES ('download'), ('transcribe'), ('chunk')) AS s(stage)
WHERE e.catalog_id = :'cid'
ON CONFLICT (episode_id, stage) DO NOTHING;

INSERT INTO jobs (id, catalog_id, episode_id, stage, status)
SELECT left(encode(sha256((e.id || '|' || s.stage)::bytea), 'hex'), 16),
       e.catalog_id, e.id, s.stage, 'queued'
FROM episodes e
CROSS JOIN (VALUES ('embed'), ('graph')) AS s(stage)
WHERE e.catalog_id = :'cid'
ON CONFLICT (episode_id, stage) DO NOTHING;

\echo 'seeded — the running worker picks these up within one poll interval:'
SELECT stage, status, count(*)
FROM jobs WHERE catalog_id = :'cid'
GROUP BY stage, status ORDER BY stage, status;
