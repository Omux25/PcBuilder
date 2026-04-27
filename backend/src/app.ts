/**
 * Hono application — mounts all routers and registers global error handling.
 *
 * This file only wires things together. No business logic lives here.
 * Import this in server.ts (production) and in integration tests.
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { authRouter } from './routes/auth.js';
import { componentsRouter } from './routes/components.js';
import { pricesRouter } from './routes/prices.js';
import { compatibilityRouter } from './routes/compatibility.js';
import { presetsRouter } from './routes/presets.js';
import { healthRouter } from './routes/health.js';
import { adminComponentsRouter } from './routes/admin/components.js';
import { adminLogsRouter } from './routes/admin/logs.js';
import { adminDashboardRouter } from './routes/admin/dashboard.js';
import { adminRetailersRouter } from './routes/admin/retailers.js';
import { adminScrapersRouter } from './routes/admin/scrapers.js';
import { adminUnmatchedRouter } from './routes/admin/unmatched.js';
import { adminPresetsRouter } from './routes/admin/presets.js';

const app = new Hono();

// CORS — allow configured origins (comma-separated in ALLOWED_ORIGINS env var)
app.use('/api/*', cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') ?? '*',
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
}));

// ── Public routes ─────────────────────────────────────────────────────────────

app.route('/api/auth', authRouter);
app.route('/api/components', componentsRouter);
app.route('/api/components', pricesRouter);          // GET /api/components/:id/prices
app.route('/api/compatibility', compatibilityRouter);
app.route('/api/builds/presets', presetsRouter);
app.route('/api/health', healthRouter);

// ── Protected routes ──────────────────────────────────────────────────────────

app.route('/api/admin/dashboard', adminDashboardRouter);
app.route('/api/admin/components', adminComponentsRouter);
app.route('/api/admin/logs', adminLogsRouter);
app.route('/api/admin/retailers', adminRetailersRouter);
app.route('/api/admin/scrapers', adminScrapersRouter);
app.route('/api/admin/unmatched-listings', adminUnmatchedRouter);
app.route('/api/admin/presets', adminPresetsRouter);

// ── Global 404 ───────────────────────────────────────────────────────────────

app.notFound((c) => {
  return c.json(
    {
      error: {
        code: 'NOT_FOUND',
        message: `Route ${c.req.method} ${c.req.path} not found`,
      },
    },
    404,
  );
});

// ── Global error handler ──────────────────────────────────────────────────────
// Catches any unhandled exception thrown inside a route handler.
// Returns a generic 500 so internal details are never leaked to clients.

app.onError((err, c) => {
  console.error('[Unhandled error]', err);
  return c.json(
    {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    },
    500,
  );
});

export { app };
