-- 002_chunks: time-aligned chunks + embeddings (day 5).

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS chunks (
    id TEXT PRIMARY KEY,                      -- det_id(episode_id, start_ms)
    catalog_id TEXT NOT NULL REFERENCES catalogs(id),
    episode_id TEXT NOT NULL REFERENCES episodes(id),
    start_s NUMERIC NOT NULL,
    end_s NUMERIC NOT NULL,
    text TEXT NOT NULL,
    -- 'english' config for the sprint (golden set is English); per-catalog
    -- language config becomes a migration when multilingual catalogs land.
    tsv tsvector GENERATED ALWAYS AS (to_tsvector('english', text)) STORED,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (episode_id, start_s)
);
CREATE INDEX IF NOT EXISTS chunks_tsv_idx ON chunks USING gin (tsv);
CREATE INDEX IF NOT EXISTS chunks_episode_idx ON chunks (episode_id);

-- Per-model embedding table (day-3 decision): vectors from different models are
-- not comparable, and pgvector columns have a fixed dimension — so each model
-- gets its own table + index. bge-m3 (1024) arrives as its own migration.
CREATE TABLE IF NOT EXISTS embeddings_openai_3small (
    chunk_id TEXT PRIMARY KEY REFERENCES chunks(id) ON DELETE CASCADE,
    catalog_id TEXT NOT NULL,
    embedding vector(1536) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS emb_oai_small_hnsw
    ON embeddings_openai_3small USING hnsw (embedding vector_cosine_ops);
