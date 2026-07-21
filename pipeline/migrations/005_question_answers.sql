-- 005: store the delivered answer with each question — the creator reviews
-- what fans were actually told, and `verdict` is the hook for later evaluation
-- (human thumbs or LLM-judge; null = unrated).

ALTER TABLE questions ADD COLUMN IF NOT EXISTS answer TEXT;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS sources JSONB;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS cost_usd NUMERIC;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS verdict TEXT
    CHECK (verdict IS NULL OR verdict IN ('good', 'bad', 'review'));
