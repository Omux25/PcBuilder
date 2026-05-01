/**
 * Server entry point — starts Bun.serve() with the Hono app.
 *
 * Run with:
 *   bun src/server.ts          (production)
 *   bun --hot src/server.ts    (development — hot reload)
 */

import { app } from './app.js';
import { startRefreshTokenCleanup } from './routes/auth.js';

const port = Number(process.env.PORT) || 3000;

const server = Bun.serve({
  port,
  fetch: app.fetch,
});

// Start background cleanup for expired refresh tokens (every 6 hours)
startRefreshTokenCleanup();

console.log(`Server running on http://localhost:${server.port}`);
