# Production Next.js image (standalone output) — build context is web/.
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

FROM node:22-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Server-only secrets (DATABASE_URL, AUTH_*) are runtime-injected via compose
# env_file/environment — nothing here needs them at build time. The one
# NEXT_PUBLIC_* var (SERVE_URL) is browser-facing and its code fallback
# (localhost:8000) is already correct for Docker, so no build ARG needed.
RUN npm run build

FROM node:22-slim AS run
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]
