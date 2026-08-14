# Chrome Extension — product surface

The Chrome extension is the fan/creator product surface. Web keeps the
landing page + admin dashboard. Fans sign in, save/add channels, ask with
cited answers, and manage a usage wallet (daily free asks → paid credits →
BYOK Anthropic key).

## Architecture

```
ext/ (MV3 side panel + YouTube content script)
  │  OIDC PKCE ──► Keycloak (public client backcat-ext)
  │  Bearer JWT ─► serve/ FastAPI
serve/
  │  JWKS validate → users / user_catalogs / questions.user_id
  │  ask debit: free daily → extra_credits → BYOK → 402
pipeline/
  └── migrations/007_users.sql
```

### Surfaces

- **Side panel** — Channels / Ask / Profile (usage meter, BYOK, buy-more mailto stub).
- **YouTube content script** — Shadow-DOM chip when `GET /api/videos/{id}` hits;
  citation seek sets `document.querySelector("video").currentTime`.
- **Web `/c/{id}`** — anonymous share page still works (IP rate limit).

### Auth & usage

- Keycloak JWT on `Authorization: Bearer` for `/api/me*` and authenticated asks.
- Anonymous `/ask` kept for the public fan page.
- `rate_limit.questions_per_user_per_day` (default 10) → then `users.extra_credits`
  → then encrypted BYOK (`users.byok_anthropic_enc`, Fernet + `BYOK_SECRET`).
- Adding a channel from the extension lists RSS episodes only — **no Whisper
  jobs**. Transcription stays admin/dashboard until paid index-hours ship.

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

Serve needs `KEYCLOAK_ISSUER` (+ `KEYCLOAK_JWKS_URL` in Docker) and migration 007
(applied by the worker on start via `migrate`).
