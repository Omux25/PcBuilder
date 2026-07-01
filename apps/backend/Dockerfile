# ── STAGE 1: Frontend Build ───────────────────────────────────────────────────
FROM oven/bun:1.3-alpine AS frontend-builder
WORKDIR /app
COPY package.json bun.lock ./
COPY apps/frontend/package.json apps/frontend/
COPY apps/admin/package.json apps/admin/
COPY apps/backend/package.json apps/backend/
RUN bun install
COPY apps/frontend/ apps/frontend/
COPY shared/ shared/
WORKDIR /app/apps/frontend
RUN apk add --no-cache chromium nss freetype harfbuzz ca-certificates ttf-freefont
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
RUN bun run build

# ── STAGE 2: Admin Build ──────────────────────────────────────────────────────
FROM oven/bun:1.3-alpine AS admin-builder
WORKDIR /app
COPY package.json bun.lock ./
COPY apps/frontend/package.json apps/frontend/
COPY apps/admin/package.json apps/admin/
COPY apps/backend/package.json apps/backend/
RUN bun install
COPY apps/admin/ apps/admin/
COPY shared/ shared/
WORKDIR /app/apps/admin
RUN bun run build

# ── STAGE 3: Backend Runtime ──────────────────────────────────────────────────
FROM oven/bun:1.3-alpine AS base

# Mirror the monorepo layout so tsconfig path aliases resolve correctly.
WORKDIR /app

# Install backend dependencies
COPY package.json bun.lock ./
COPY apps/frontend/package.json apps/frontend/
COPY apps/admin/package.json apps/admin/
COPY apps/backend/package.json apps/backend/
RUN bun install --production

# Copy backend source
COPY apps/backend/src/ apps/backend/src/
COPY apps/backend/scripts/ apps/backend/scripts/
COPY apps/backend/tsconfig.json apps/backend/

# Copy shared utilities
COPY shared/ shared/

WORKDIR /app/apps/backend

# Copy built frontend assets from previous stages
# These are used when SERVE_STATIC=true.
# Paths are relative to WORKDIR (/app/apps/backend) to match app.ts serveStatic paths:
#   './admin/dist'   → /app/apps/backend/admin/dist
#   './frontend/dist' → /app/apps/backend/frontend/dist
COPY --from=frontend-builder /app/apps/frontend/dist ./frontend/dist
COPY --from=admin-builder /app/apps/admin/dist ./admin/dist

# Run as non-root user
USER bun

EXPOSE 3000

# Entry point starts the Hono server
CMD ["sh", "-c", "bun run scripts/purge_bad_mappings.ts && bun run scripts/revalidateMappings.ts && bun run scripts/purge_bad_history.ts && bun run migrate && bun run src/server.ts"]
