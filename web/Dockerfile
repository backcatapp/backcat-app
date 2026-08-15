# Production Next.js image (standalone output) — build context is web/.
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

FROM node:22-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Server-only secrets (DATABASE_URL, AUTH_*) are runtime-injected via compose.
# NEXT_PUBLIC_SERVE_URL is inlined into the client bundle at build time, so
# compose passes it as a build arg from PUBLIC_HOST.
ARG NEXT_PUBLIC_SERVE_URL=http://localhost:8000
ENV NEXT_PUBLIC_SERVE_URL=$NEXT_PUBLIC_SERVE_URL
RUN npm run build

FROM node:22-slim AS run
WORKDIR /app
ENV NODE_ENV=production
ARG NEXT_PUBLIC_SERVE_URL=http://localhost:8000
ENV NEXT_PUBLIC_SERVE_URL=$NEXT_PUBLIC_SERVE_URL
COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]
