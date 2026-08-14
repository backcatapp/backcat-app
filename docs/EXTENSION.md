# Chrome Extension — product surface

The Chrome extension is the fan/creator product surface. Web keeps the
landing page (extension-first) + admin dashboard. Fans sign in, save/add
channels, ask with cited answers, and manage a usage wallet (daily free asks
→ paid credits → BYOK Anthropic key).

## Architecture

```
ext/ (MV3 side panel + YouTube content script)
  │  OIDC PKCE ──► Keycloak (public client backcat-ext)
  │  Bearer JWT ─► serve/ FastAPI
serve/
  │  JWKS validate → users / user_catalogs / questions.user_id
  │  ask debit: free daily → extra_credits → BYOK → 402
  │  POST /api/me/credit-request → credit_requests (we'll contact you)
pipeline/
  └── migrations/007_users.sql, 008_waitlist_and_events.sql
web/
  └── landing (Postgres waitlist) + /dashboard Users · Funnel · Costs · Jobs
```

### Surfaces

- **Side panel** — Channels / Ask / Graph / Profile. Profile **Request more credits**
  opens a `credit_requests` row (no checkout — we'll email you).
- **YouTube content script** — **Backcat** pill → on-page Ask panel (history,
  keyboard trap); Graph/side panel closes the on-page panel. Episode-scoped graph.
- **Web landing** — Chrome extension CTA + screenshot slots in `public/landing/`.
- **Web `/c/{id}`** — anonymous share page still works (IP rate limit).

### Admin dashboard (Keycloak `admin`)

| Path | Purpose |
|------|---------|
| `/dashboard/users` | Users + waitlist-only; credit-request inbox on detail |
| `/dashboard/funnel` | Waitlist → signup → save → index → ask |
| `/dashboard/costs` | Daily / service / catalog spend from `cost_events` |
| `/dashboard/jobs` | Failed-first filter, retry, retry-all failed |

### Auth & usage

- Keycloak JWT on `Authorization: Bearer` for `/api/me*` and authenticated asks.
- `GET /api/me/catalogs/{id}/episodes` lists episodes for owned/saved catalogs.
- Anonymous `/ask` kept for the public fan page.
- `rate_limit.questions_per_user_per_day` (default 10) → then `users.extra_credits`
  → then encrypted BYOK (`users.byok_anthropic_enc`, Fernet + `BYOK_SECRET`).
- Adding a channel from the extension lists RSS episodes; **Index** on a video
  queues Whisper→embed→graph (`jobs.requested_by` stamped). Worker must be running.
- Landing waitlist → Postgres `waitlist` (not Supabase).

### CORS

Serve allows `CORS_ORIGIN` plus `chrome-extension://.*` and the `authorization` header.

## Local load

```bash
cd ext && npm install && npm run build
# chrome://extensions → Load unpacked → ext/dist
```

Keycloak must include client `backcat-ext` and `registrationAllowed: true`
(see `infra/keycloak/backcat-realm.json`). Recreate Keycloak after realm changes:

```bash
docker compose up -d --force-recreate keycloak
```

Wait ~45s for first boot (Quarkus augmentation). Confirm with:
`http://localhost:8080/realms/backcat` → should load.

The ext client's Valid Redirect URIs is `*` in local/dev — Keycloak does **not**
treat `https://*.chromiumapp.org/*` as a hostname wildcard, so the Chrome
identity redirect (`https://<extension-id>.chromiumapp.org/`) would get
`invalid_redirect_uri` otherwise. Tighten before any store listing.
