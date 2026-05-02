/**
 * Server entry point — starts Bun.serve() with the Hono app.
 *
 * Run with:
 *   bun src/server.ts          (production)
 *   bun --hot src/server.ts    (development — hot reload)
 */

import { app } from './app.js';
import { startRefreshTokenCleanup } from './routes/auth.js';

// ── Startup validation ────────────────────────────────────────────────────────
// Fail fast on missing required environment variables rather than silently
// serving a broken API. JWT_SECRET is required for all admin auth to work.

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret.length < 32) {
  console.error(
    '[startup] FATAL: JWT_SECRET is not set or is shorter than 32 characters.\n' +
    '  Generate one with: openssl rand -hex 32\n' +
    '  Then set it in your .env file or environment.'
  );
  process.exit(1);
}

const port = Number(process.env.PORT) || 3000;

const server = Bun.serve({
  port,
  fetch: app.fetch,
});

// Start background cleanup for expired refresh tokens (every 6 hours)
startRefreshTokenCleanup();

console.log(`Server running on http://localhost:${server.port}`);
