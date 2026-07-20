-- Adds the two optional qualifying fields to an existing waitlist table.
-- Only needed if you created the table before these columns existed —
-- a fresh run of schema.sql already includes them. Safe to run twice.

alter table public.waitlist
  add column if not exists feed_url text,
  add column if not exists sample_question text;
