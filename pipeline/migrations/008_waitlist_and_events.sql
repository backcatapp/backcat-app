-- 008: waitlist (local Postgres), user activity events, credit requests,
-- job attribution, ask debit_mode.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS waitlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    feed_url TEXT,
    sample_question TEXT,
    source TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS waitlist_email_key ON waitlist (lower(email));

CREATE TABLE IF NOT EXISTS user_events (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    email TEXT,
    event TEXT NOT NULL,
    props JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_events_user_idx ON user_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS user_events_email_idx ON user_events (lower(email), created_at DESC);
CREATE INDEX IF NOT EXISTS user_events_event_idx ON user_events (event, created_at DESC);

CREATE TABLE IF NOT EXISTS credit_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    email TEXT NOT NULL,
    note TEXT,
    status TEXT NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'contacted', 'fulfilled', 'closed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS credit_requests_status_idx ON credit_requests (status, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS credit_requests_open_email
    ON credit_requests (lower(email)) WHERE status = 'open';

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS requested_by TEXT REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS jobs_requested_by_idx ON jobs (requested_by) WHERE requested_by IS NOT NULL;

ALTER TABLE questions ADD COLUMN IF NOT EXISTS debit_mode TEXT
    CHECK (debit_mode IS NULL OR debit_mode IN ('free', 'credit', 'byok'));
