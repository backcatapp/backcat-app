# Web (Next.js)

Landing (Chrome extension product page) + admin dashboard.

## Env: development vs production

Compose browser URLs come from the **repo-root** `.env` (`PUBLIC_HOST`). Change that one value when the public IP moves; do not edit `docker-compose.yml` or `web/.env.*` for the address.

| Machine | Root | Web |
|---------|------|-----|
| Laptop (dev) | No `.env`, or `cp .env.development.example .env` | `cp web/.env.development.example web/.env.local` |
| EC2 (prod) | `cp .env.production.example .env` (`PUBLIC_HOST=<ip>`) | `cp web/.env.production.example web/.env.local` (secrets only; no IP) |

If local auth points at an AWS IP, delete a leftover production `.env`:

```bash
rm .env
docker compose up -d --force-recreate keycloak serve web
```

Waitlist and credit requests use product Postgres. Admin: `/dashboard/users`, `/funnel`, `/costs`, `/jobs`.

Screenshots: `public/landing/`.
