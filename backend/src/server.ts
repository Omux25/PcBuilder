/**
 * Server entry point — starts Bun.serve() with the Hono app.
 *
 * Run with:
 *   bun src/server.ts          (production)
 *   bun --hot src/server.ts    (development — hot reload)
 */

import { app } from './app.js';

const port = Number(process.env.PORT) || 3000;

const server = Bun.serve({
  port,
  fetch: app.fetch,
});

console.log(`Server running on http://localhost:${server.port}`);
