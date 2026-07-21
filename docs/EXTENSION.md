# Chrome Extension — design prep (not scheduled yet)

Goal: embed Backcat into the YouTube watch page the way vidIQ does — a panel
beside/below the player. If the video belongs to an indexed catalog, fans ask
questions right there, and **citations seek the actual player on the page**
(no iframe embed needed — better than the web experience).

## Architecture sketch

- **Manifest V3**, content script on `youtube.com/watch*`.
- Panel rendered inside **Shadow DOM** (style isolation from YouTube's CSS);
  brand tokens inlined. No frameworks — vanilla TS or Preact, keep it <50KB.
- On navigation (YouTube is a SPA — listen to `yt-navigate-finish`), extract
  the video id, call `GET /api/videos/{youtube_id}` (to build in serve/):
  returns `{catalog_id, episode_id, catalog_name}` or 404 → panel hidden.
  Backed by an index on `episodes.source_url` (already stored since 004).
- Ask flow reuses the **exact SSE protocol** of `/api/catalogs/{id}/ask` —
  the `lib/ask.ts` client is portable as-is (plain fetch + streams).
- **Citation click seeks the real player**: `document.querySelector("video")
  .currentTime = start_s` — the moment plays in the page's own player.
  This is the killer interaction the web app can only approximate.
- Auth: none for MVP (same public rate limits as the fan page). Fan accounts
  (Keycloak `fan` role) would enable history sync later.
- CORS: allow `chrome-extension://<id>` origin in serve.

## Why it matters

Distribution: meets fans where they already are; every panel is a Backcat ad
on the creator's own video. Also a natural creator pitch: "install this and
watch your own catalog answer."

## Effort estimate

MVP (panel + lookup + ask + seek): ~2–3 days. Store listing + review: +1 week
lead time. Sensible slot: after day 14 (needs a public serve deployment), as
a marketing-sprint demo weapon.
