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
  Channels expands to list episodes (title → YouTube, indexed vs listed-only badge;
  Ask disabled until indexed).
- **YouTube content script** — native-style **Ask** pill in the watch-page actions
  row (Share / Download / Save). Click opens an in-page right panel (Shadow DOM,
  Eigengrau + Tabby) for streaming cited answers; citations seek the page `<video>`.
  Listed-but-not-indexed videos get the pill + a manage/side-panel prompt instead
  of Ask. `GET /api/videos/{id}` (+ optional Bearer for saved/owned).
- **Web `/c/{id}`** — anonymous share page still works (IP rate limit).

### Auth & usage

- Keycloak JWT on `Authorization: Bearer` for `/api/me*` and authenticated asks.
- `GET /api/me/catalogs/{id}/episodes` lists episodes for owned/saved catalogs.
- Anonymous `/ask` kept for the public fan page.
- `rate_limit.questions_per_user_per_day` (default 10) → then `users.extra_credits`
  → then encrypted BYOK (`users.byok_anthropic_enc`, Fernet + `BYOK_SECRET`).
- Adding a channel from the extension lists RSS episodes; **Index** on a video
  queues Whisper→embed→graph (worker must be running; ~$0.04/audio-hour).
  Kill-switch still applies.

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