# ── STAGE 1: Frontend Build ───────────────────────────────────────────────────
FROM oven/bun:1.3-alpine AS frontend-builder
WORKDIR /app/frontend
COPY apps/frontend/package.json apps/frontend/bun.lock ./
RUN bun install --frozen-lockfile
COPY apps/frontend/ ./
RUN bun run build

# ── STAGE 2: Admin Build ──────────────────────────────────────────────────────
FROM oven/bun:1.3-alpine AS admin-builder
WORKDIR /app/admin
COPY apps/admin/package.json apps/admin/bun.lock ./
RUN bun install --frozen-lockfile
COPY apps/admin/ ./
RUN bun run build

# ── STAGE 3: Backend Runtime ──────────────────────────────────────────────────
FROM oven/bun:1.3-alpine AS base
WORKDIR /app

# Install backend dependencies
COPY apps/backend/package.json apps/backend/bun.lock ./
RUN bun install --frozen-lockfile --production

# Copy backend source
COPY apps/backend/src/ ./src/
COPY apps/backend/scraper/ ./scraper/
COPY apps/backend/tsconfig.json ./

# Copy built frontend assets from previous stages
# These are used when SERVE_STATIC=true
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist
COPY --from=admin-builder /app/admin/dist ./admin/dist

# Run as non-root user
USER bun

EXPOSE 3000

# Entry point starts the Hono server
CMD ["bun", "run", "src/server.ts"]
