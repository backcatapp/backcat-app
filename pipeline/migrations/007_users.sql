-- 007_users: fan/creator identity for the Chrome extension product surface.
-- Keycloak `sub` is the primary key; catalogs stay global, ownership via user_catalogs.
-- BYOK Anthropic keys are Fernet-encrypted (BYOK_SECRET); plaintext never stored.
-- questions.user_id is nullable so anonymous /c/{id} (IP rate limit) still works.

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,                          -- Keycloak sub
    email TEXT NOT NULL,
    display_name TEXT,
    extra_credits INT NOT NULL DEFAULT 0,
    byok_anthropic_enc TEXT,                      -- Fernet ciphertext, or NULL
    byok_last4 TEXT,                              -- last 4 chars for Profile UI
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_catalogs (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    catalog_id TEXT NOT NULL REFERENCES catalogs(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('owned', 'saved')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, catalog_id, kind)
);
CREATE INDEX IF NOT EXISTS user_catalogs_user_idx ON user_catalogs (user_id);

ALTER TABLE questions ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES users(id);
CREATE INDEX IF NOT EXISTS questions_user_idx ON questions (user_id, created_at);
