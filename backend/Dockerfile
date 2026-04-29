FROM oven/bun:1.3-alpine AS base

WORKDIR /app

# Install dependencies first (cached layer)
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# Copy source code only (not scripts, tests, or SQL files)
COPY src/ ./src/
COPY scraper/ ./scraper/
COPY tsconfig.json ./

# Run as non-root user for security
USER bun

EXPOSE 3000

CMD ["bun", "run", "src/server.ts"]
