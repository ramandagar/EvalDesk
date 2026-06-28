# syntax=docker/dockerfile:1
# EvalDesk — Next.js standalone production image.
# Builds & runs on x86_64 AND arm64 (Oracle Ampere A1, Apple Silicon, Graviton).
# `output: standalone` is set in next.config.ts → the app is `node server.js`.

FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat

# ── deps: install with build tools so native addons (better-sqlite3) compile ──
FROM base AS deps
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci || npm install

# ── builder: compile the Next.js standalone output ───────────────────────────
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN mkdir -p data public
# Migrations are committed under /drizzle and applied by the app on boot
# (initAppDb → migratePg), so we don't run drizzle-kit at build time.
# Raise the Node heap so the build completes on memory-constrained hosts.
ENV NODE_OPTIONS="--max-old-space-size=1024"
RUN npm run build

# ── runner: minimal production image ─────────────────────────────────────────
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/data ./data
COPY --from=builder /app/drizzle ./drizzle

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
