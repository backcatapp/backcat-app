-- 003_questions: every fan question is logged (product principle #2 — honest
-- absence feeds gap nodes and the v1.0 gap report). Also the rate-limit source.

CREATE TABLE IF NOT EXISTS questions (
    id BIGSERIAL PRIMARY KEY,
    catalog_id TEXT NOT NULL REFERENCES catalogs(id),
    question TEXT NOT NULL,
    answered BOOLEAN NOT NULL,                -- false = honest absence -> gap signal
    confidence NUMERIC,                       -- top dense similarity at ask time
    ip TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS questions_catalog_idx ON questions (catalog_id, created_at);
CREATE INDEX IF NOT EXISTS questions_ip_idx ON questions (ip, created_at);
