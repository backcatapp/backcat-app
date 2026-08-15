# Backcat Chrome extension

## Dev

```bash
cd ext
npm install
npm run build
```

Load unpacked in Chrome: `chrome://extensions` → Developer mode → Load unpacked → select `ext/dist`.

Sign-in uses Keycloak public client `backcat-ext` (PKCE). Ensure Keycloak is up (`docker compose up -d keycloak`) with the committed realm export (registration enabled).

Env: the build reads `PUBLIC_HOST` from the repo-root `.env` (same file Compose uses). Optional `ext/.env` overrides:

```
VITE_SERVE_URL=http://localhost:8000
VITE_KEYCLOAK_URL=http://localhost:8080
VITE_KEYCLOAK_REALM=backcat
VITE_KEYCLOAK_CLIENT_ID=backcat-ext
```

After changing Keycloak redirect URIs, rebuild Keycloak from the realm export (`docker compose up -d --force-recreate keycloak`).

## Surfaces

- **Side panel** — Channels / Ask / Profile (usage, BYOK, buy-more stub)
- **YouTube content script** — chip when the watch video is in an indexed catalog; citation seek hits the page `<video>`
