-- 004: where the episode lives publicly (YouTube watch URL, podcast episode
-- page). Citations deep-link/embed the player seeked to the chunk timestamp.

ALTER TABLE episodes ADD COLUMN IF NOT EXISTS source_url TEXT;
