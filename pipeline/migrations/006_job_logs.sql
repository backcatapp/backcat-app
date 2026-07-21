-- 006: per-job progress log — what the worker is doing inside a stage,
-- visible live in the dashboard Jobs page. Reset on each attempt.

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS logs TEXT;
