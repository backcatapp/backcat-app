-- 001_init: day-4 ingestion schema.
-- Rules: all writes upsert (ON CONFLICT), all IDs deterministic — see CLAUDE.md.

CREATE TABLE IF NOT EXISTS catalogs (
    id TEXT PRIMARY KEY,                      -- det_id(rss_url)
    name TEXT NOT NULL,
    rss_url TEXT NOT NULL UNIQUE,
    embedding_provider TEXT NOT NULL DEFAULT 'openai',
    paused BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS episodes (
    id TEXT PRIMARY KEY,                      -- det_id(catalog_id, guid)
    catalog_id TEXT NOT NULL REFERENCES catalogs(id),
    guid TEXT NOT NULL,
    title TEXT NOT NULL,
    audio_url TEXT NOT NULL,
    published_at TIMESTAMPTZ,
    duration_s INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (catalog_id, guid)
);

-- One row per (episode, stage). This table IS the status page and the DLQ:
-- retries bump attempt_count; >= max attempts => status 'failed' (terminal, founder review).
CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,                      -- det_id(episode_id, stage)
    catalog_id TEXT NOT NULL REFERENCES catalogs(id),
    episode_id TEXT NOT NULL REFERENCES episodes(id),
    stage TEXT NOT NULL CHECK (stage IN ('download', 'transcribe', 'chunk', 'embed', 'graph')),
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'done', 'failed')),
    attempt_count INTEGER NOT NULL DEFAULT 0,
    error TEXT,
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    UNIQUE (episode_id, stage)
);
CREATE INDEX IF NOT EXISTS jobs_catalog_status_idx ON jobs (catalog_id, status);

CREATE TABLE IF NOT EXISTS transcripts (
    episode_id TEXT PRIMARY KEY REFERENCES episodes(id),
    catalog_id TEXT NOT NULL REFERENCES catalogs(id),
    language TEXT,
    model TEXT NOT NULL,
    text TEXT NOT NULL,
    words JSONB NOT NULL,                     -- [{"w": word, "s": start_s, "e": end_s}], episode-level offsets
    audio_duration_s NUMERIC NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Mandatory on every paid API call. Feeds the public build log and the spend guard.
CREATE TABLE IF NOT EXISTS cost_events (
    id BIGSERIAL PRIMARY KEY,
    catalog_id TEXT REFERENCES catalogs(id),
    episode_id TEXT REFERENCES episodes(id),
    service TEXT NOT NULL,                    -- groq_whisper | openai_embed | anthropic_extract | ...
    model TEXT NOT NULL,
    units NUMERIC NOT NULL,
    unit_kind TEXT NOT NULL,                  -- audio_hours | tokens
    cost_usd NUMERIC NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cost_events_catalog_idx ON cost_events (catalog_id, created_at);

-- DB-backed config; precedence everywhere: DB value -> env fallback (day-4 decision).
CREATE TABLE IF NOT EXISTS app_config (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
