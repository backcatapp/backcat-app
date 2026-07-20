# backcat — landing page

Next.js (App Router) port of the Backcat landing design, with a Supabase-backed waitlist.

```bash
npm install
npm run dev
```

## Waitlist setup

The form in the final CTA section writes to a Supabase table. Four steps:

### 1. Create the project

At [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**. Pick a region
close to your users; the free tier is plenty for a waitlist.

### 2. Create the table

Dashboard → **SQL Editor** → **New query**, paste the contents of
[supabase/schema.sql](supabase/schema.sql), and run it.

This creates `public.waitlist` with a unique index on `lower(email)` and enables RLS with **no
policies** — so the `anon` and `authenticated` roles cannot read or write it at all. Only the
service role key can, and that key never leaves the server.

Columns captured per signup:

| Column | Notes |
| --- | --- |
| `email` | required |
| `feed_url` | their podcast RSS or YouTube channel — optional, normalized to a full `https://` URL |
| `sample_question` | a question their audience keeps asking — optional, capped at 500 chars |
| `source`, `user_agent`, `created_at` | set automatically |

> Already ran an earlier version of the schema? Run
> [supabase/migrations/001_add_feed_and_question.sql](supabase/migrations/001_add_feed_and_question.sql)
> instead — it adds `feed_url` and `sample_question` without touching existing rows.

### 3. Add the credentials

Dashboard → **Project Settings** → **API**, then copy `.env.example` to `.env.local` and fill in:

```
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Take the key labelled **`service_role`**, not `anon`. Neither var is prefixed `NEXT_PUBLIC_`,
which is what keeps them server-side — do not add that prefix. `.env.local` is gitignored.

Restart `npm run dev` after creating the file; Next only reads env files at boot.

### 4. Deploy

Set the same two variables in your host's environment settings (on Vercel: Project → Settings →
Environment Variables). Nothing else to configure.

## Reading your signups

Dashboard → **Table Editor** → `waitlist`. To export: **SQL Editor** →
`select email, created_at from waitlist order by created_at desc;` → *Download CSV*.

## How it works

| File | Role |
| --- | --- |
| [app/actions/waitlist.ts](app/actions/waitlist.ts) | Server Action — validates, inserts, maps errors to user-facing copy |
| [lib/supabase.ts](lib/supabase.ts) | Service-role client; server-only, never import from a client component |
| [lib/waitlist-state.ts](lib/waitlist-state.ts) | Shared result type (a `"use server"` file may only export async functions, so it lives here) |
| [components/WaitlistForm.tsx](components/WaitlistForm.tsx) | Client form, `useActionState` + pending state |

Submissions run through a Server Action rather than a public API route, so there is no endpoint to
find and the database key is never shipped to the browser. The form carries a hidden honeypot
field; bots that fill it get a success response and no insert.

Duplicate addresses are caught by the unique index and reported as *"You're already on the list"*
rather than an error — resubmitting the same email is not a failure from the visitor's side. If the
resubmission carries a feed URL or question the first one lacked, those fields are patched onto the
existing row rather than discarded.

`feed_url` accepts what people actually type (`youtube.com/@show`, a bare RSS domain, a full URL)
and stores a canonical `https://` form. Non-web schemes such as `javascript:` are rejected before
the insert.

## Notes

- Fonts are self-hosted via `next/font` (Bricolage Grotesque, Instrument Sans, IBM Plex Mono).
- Responsive bento grid is pure CSS at 640 / 980 / 1200px breakpoints.
- [components/Motion.tsx](components/Motion.tsx) holds the scroll-reveal, count-up, and
  pause-animations-until-hover behavior — the only stateful piece outside the form and hero.
