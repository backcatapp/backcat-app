# Web (Next.js)

Landing (Chrome extension product page) + admin dashboard.

## Env: development vs production

Compose browser URLs come from the **repo-root** `.env` (`PUBLIC_WEB`, `PUBLIC_KEYCLOAK`).

| Machine | Root | Web |
|---------|------|-----|
| Laptop (dev) | No `.env`, or `cp .env.development.example .env` | `cp web/.env.development.example web/.env.local` |
| EC2 (prod) | `cp .env.production.example .env` | `cp web/.env.production.example web/.env.local` |

If local auth points at an AWS IP, delete a leftover production `.env`:

```bash
rm .env
docker compose up -d --force-recreate keycloak serve web
```

Waitlist and credit requests use product Postgres. Admin: `/dashboard/users`, `/funnel`, `/costs`, `/jobs`.

Screenshots: `public/landing/`.
