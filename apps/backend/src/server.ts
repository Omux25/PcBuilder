/**
 * Server entry point — starts Bun.serve() with the Hono app.
 *
 * Run with:
 *   bun src/server.ts          (production)
 *   bun --hot src/server.ts    (development — hot reload)
 */

import { app } from './app.js';
import { startRefreshTokenCleanup, stopRefreshTokenCleanup } from './routes/auth.js';

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

const portStr = process.env.PORT;
if (portStr && isNaN(Number(portStr))) {
  console.error('[startup] FATAL: PORT must be a valid number.');
  process.exit(1);
}

const hasDbUrl = !!process.env.DATABASE_URL;
const hasPgVars = !!(process.env.PGDATABASE && process.env.PGUSER && process.env.PGHOST);

if (!hasDbUrl && !hasPgVars) {
  console.error('[startup] FATAL: Neither DATABASE_URL nor individual PG variables (PGDATABASE, PGUSER, PGHOST) are set in the environment.');
  process.exit(1);
}

if (process.env.NODE_ENV === 'production' && !process.env.ALLOWED_ORIGINS) {
  console.warn('[startup] WARNING: ALLOWED_ORIGINS is not set in production. CORS will default to *');
}

const port = Number(portStr) || 3000;

const server = Bun.serve({
  port,
  fetch: app.fetch,
});

// Start background cleanup for expired refresh tokens (every 6 hours)
startRefreshTokenCleanup();

// Start the scraper scheduler (only in production — not in test/dev without explicit opt-in)
if (process.env.ENABLE_SCHEDULER === 'true') {
  const { startScheduler } = await import('../scraper/scheduler.js');
  startScheduler();
}

console.log(`Server running on http://localhost:${server.port}`);

// ── Graceful shutdown ─────────────────────────────────────────────────────────
// Handle SIGTERM (Docker stop, Kubernetes) and SIGINT (Ctrl+C) gracefully.
// Stops accepting new connections and waits for in-flight requests to finish.

async function shutdown(signal: string): Promise<void> {
  console.log(`[shutdown] Received ${signal} — shutting down gracefully...`);

  // Stop the scheduler so no new scraping sessions start
  if (process.env.ENABLE_SCHEDULER === 'true') {
    const { stopScheduler } = await import('../scraper/scheduler.js');
    stopScheduler();
  }

  // Stop the refresh token cleanup interval
  stopRefreshTokenCleanup();

  // Stop accepting new connections
  server.stop();

  console.log('[shutdown] Server stopped.');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
