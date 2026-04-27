FROM oven/bun:1.3-alpine

WORKDIR /app

# Install dependencies first (cached layer)
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# Copy source code
COPY src/ ./src/
COPY scraper/ ./scraper/
COPY tsconfig.json ./

# Copy frontend build output (mounted at build time or pre-built)
# The frontend/dist directory is served as static files in production
COPY --chown=bun:bun . .

EXPOSE 3000

CMD ["bun", "run", "src/server.ts"]
