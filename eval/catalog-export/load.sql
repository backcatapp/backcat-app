-- Load the "دوام | Davam" catalog (the one eval/golden_set.json was built from)
-- into another Backcat database, preserving IDs exactly.
--
-- Why IDs must be preserved: eval_questions.catalog_id and eval_pool.chunk_id are
-- foreign keys into catalogs/chunks. Re-ingesting the channel instead would give
-- the same catalog_id and episode_ids (both deterministic) but NOT the same chunk
-- ids — chunk ids are det_id(episode_id, start_ms) and start_ms comes from the
-- Whisper transcript, which is not reproducible run to run. Copying the rows is
-- what keeps an existing golden set and benchmark run valid.
--
-- Run from this directory (\copy resolves paths client-side):
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f load.sql
--
-- Idempotent: ON CONFLICT DO NOTHING is untargeted on purpose — each table has a
-- secondary unique constraint (catalogs.rss_url, episodes(catalog_id,guid),
-- chunks(episode_id,start_s)) that a PK-targeted clause would not absorb.
--
-- NOT included: embeddings and the Neo4j graph. This payload is enough to judge
-- at /dashboard/eval and to run import-golden + build-pool. Running `backcat-eval
-- run` here as well would additionally need the embedding rows and the graph.

BEGIN;

CREATE TEMP TABLE t_catalogs (
    id TEXT, name TEXT, rss_url TEXT, embedding_provider TEXT,
    paused BOOLEAN, created_at TIMESTAMPTZ
) ON COMMIT DROP;
\copy t_catalogs FROM 'catalogs.csv' WITH CSV

CREATE TEMP TABLE t_episodes (
    id TEXT, catalog_id TEXT, guid TEXT, title TEXT, audio_url TEXT,
    published_at TIMESTAMPTZ, duration_s INTEGER, created_at TIMESTAMPTZ, source_url TEXT
) ON COMMIT DROP;
\copy t_episodes FROM 'episodes.csv' WITH CSV

-- chunks.tsv is a GENERATED column: it is deliberately absent here and Postgres
-- recomputes it on insert.
CREATE TEMP TABLE t_chunks (
    id TEXT, catalog_id TEXT, episode_id TEXT, start_s NUMERIC, end_s NUMERIC,
    text TEXT, created_at TIMESTAMPTZ
) ON COMMIT DROP;
\copy t_chunks FROM 'chunks.csv' WITH CSV

INSERT INTO catalogs (id, name, rss_url, embedding_provider, paused, created_at)
SELECT id, name, rss_url, embedding_provider, paused, created_at FROM t_catalogs
ON CONFLICT DO NOTHING;

INSERT INTO episodes (id, catalog_id, guid, title, audio_url, published_at, duration_s, created_at, source_url)
SELECT id, catalog_id, guid, title, audio_url, published_at, duration_s, created_at, source_url FROM t_episodes
ON CONFLICT DO NOTHING;

INSERT INTO chunks (id, catalog_id, episode_id, start_s, end_s, text, created_at)
SELECT id, catalog_id, episode_id, start_s, end_s, text, created_at FROM t_chunks
ON CONFLICT DO NOTHING;

COMMIT;

\echo 'loaded — expect 1 catalog / 15 episodes / 198 chunks:'
SELECT
    (SELECT count(*) FROM catalogs WHERE id = '6f2ef26393812d69') AS catalogs,
    (SELECT count(*) FROM episodes WHERE catalog_id = '6f2ef26393812d69') AS episodes,
    (SELECT count(*) FROM chunks   WHERE catalog_id = '6f2ef26393812d69') AS chunks;
