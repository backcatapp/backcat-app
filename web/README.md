# Web (Next.js)

Landing (Chrome extension product page) + admin dashboard.

## Env

```env
DATABASE_URL=postgresql://backcat:backcat@localhost:5432/backcat
AUTH_SECRET=…
AUTH_KEYCLOAK_ID=backcat-web
AUTH_KEYCLOAK_SECRET=…
AUTH_KEYCLOAK_ISSUER=http://localhost:8080/realms/backcat
SERVE_INTERNAL_URL=http://localhost:8000
INTERNAL_TOKEN=dev-internal-token
NEXT_PUBLIC_CHROME_STORE_URL=https://chromewebstore.google.com/detail/…
```

Waitlist and credit requests write to **local Postgres** (`waitlist`, `credit_requests`) — same DB as the pipeline. No Supabase.

## Admin (Keycloak `admin` role)

- `/dashboard/users` — users + waitlist-only emails; credit requests
- `/dashboard/funnel` — waitlist → signup → save → index → ask
- `/dashboard/costs` — spend charts from `cost_events`
- `/dashboard/jobs` — failed-first filter + retry / retry-all

## Landing screenshots

Place PNGs in `public/landing/` — see that folder’s README.
