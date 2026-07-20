-- Backcat waitlist schema.
-- Run this once in the Supabase SQL editor (Dashboard -> SQL Editor -> New query).
--
-- Already ran an earlier version of this file? Run migrations/001_add_feed_and_question.sql
-- instead — it adds the new columns without touching your existing rows.

create table if not exists public.waitlist (
  id               uuid primary key default gen_random_uuid(),
  email            text not null,
  feed_url         text,          -- their podcast RSS / YouTube channel, if they have one
  sample_question  text,          -- a question their audience actually asks
  source           text,
  user_agent       text,
  created_at       timestamptz not null default now()
);

-- One row per address. The signup action relies on this to detect duplicates.
create unique index if not exists waitlist_email_key
  on public.waitlist (lower(email));

-- RLS on with NO policies: anon and authenticated roles can do nothing at all.
-- Only the service_role key (server-side, never shipped to the browser) bypasses
-- RLS, and that is the only thing the app uses to write here.
alter table public.waitlist enable row level security;

-- Optional: read your signups from the SQL editor or dashboard as usual —
-- the dashboard uses the service role, so it is unaffected by the above.
