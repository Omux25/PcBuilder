/**
 * Hono application — mounts all routers and registers global error handling.
 *
 * This file only wires things together. No business logic lives here.
 * Import this in server.ts (production) and in integration tests.
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { serveStatic } from 'hono/bun';
import { authRouter } from './routes/auth.js';
import { componentsRouter } from './routes/components.js';
import { compatibilityRouter } from './routes/compatibility.js';
import { healthRouter } from './routes/health.js';
import { presetsRouter } from './routes/presets.js';
import { marketTrendsRouter } from './routes/marketTrends.js';
import { adminComponentsRouter } from './routes/admin/components.js';
import { adminLogsRouter } from './routes/admin/logs.js';
import { adminDashboardRouter } from './routes/admin/dashboard.js';
import { adminRetailersRouter } from './routes/admin/retailers.js';
import { adminScrapersRouter } from './routes/admin/scrapers.js';
import { adminUnmatchedRouter } from './routes/admin/unmatched.js';
import { unmatchedSuggestionsRouter } from './routes/admin/unmatchedSuggestions.js';
import { unmatchedAccordionRouter } from './routes/admin/unmatchedAccordion.js';
import { adminPresetsRouter } from './routes/admin/presets.js';
import { scraperUrlsRouter } from './routes/admin/scraperUrls.js';
import { keywordRulesRouter } from './routes/admin/keywordRulesRouter.js';
import { AppError } from './utils/errors.js';

const app = new Hono();

// ── Security Headers ─────────────────────────────────────────────────────────
app.use('*', secureHeaders());

// ── Request logging ──────────────────────────────────────────────────────────
app.use('*', logger());

// ── CORS ─────────────────────────────────────────────────────────────────────
// Allow configured origins (comma-separated in ALLOWED_ORIGINS env var).
// When credentials: true is used, a wildcard origin is not allowed by browsers
// (CORS spec forbids it). We require an explicit origin list in production.
// In development (no ALLOWED_ORIGINS set), we allow all origins for convenience.

function getAllowedOrigins(): string | string[] {
  const raw = process.env.ALLOWED_ORIGINS?.trim();
  if (!raw || raw === '*') {
    // In production, log a warning — credentials + wildcard is a security risk
    if (process.env.NODE_ENV === 'production') {
      console.warn('[CORS] WARNING: ALLOWED_ORIGINS is not set. Defaulting to * in production is a security risk. Set ALLOWED_ORIGINS to a comma-separated list of allowed origins.');
    }
    return '*';
  }
  return raw.split(',').map((o) => o.trim()).filter(Boolean);
}

// credentials: true is required for the httpOnly refresh-token cookie to be sent.
// Note: when origin is '*', browsers will reject credentialed requests — this is
// intentional behavior that forces proper ALLOWED_ORIGINS configuration in production.
app.use('/api/*', cors({
  origin: getAllowedOrigins(),
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
}));

// ── Public routes ─────────────────────────────────────────────────────────────

app.route('/api/auth', authRouter);
app.route('/api/builds/presets', presetsRouter);
app.route('/api/components', componentsRouter);
app.route('/api/compatibility', compatibilityRouter);
app.route('/api/health', healthRouter);
app.route('/api/market-trends', marketTrendsRouter);

// ── Protected routes ──────────────────────────────────────────────────────────

app.route('/api/admin/dashboard', adminDashboardRouter);
app.route('/api/admin/components', adminComponentsRouter);
app.route('/api/admin/logs', adminLogsRouter);
app.route('/api/admin/retailers', adminRetailersRouter);
app.route('/api/admin/scrapers', adminScrapersRouter);
// scraperUrlsRouter adds POST /api/admin/scrapers/scrape-urls — no conflict with adminScrapersRouter
app.route('/api/admin/scrapers', scraperUrlsRouter);
app.route('/api/admin/unmatched-listings', adminUnmatchedRouter);
// unmatchedSuggestionsRouter adds /grouped, /reprocess, /bulk-* — no conflict with adminUnmatchedRouter
app.route('/api/admin/unmatched-listings', unmatchedSuggestionsRouter);
// unmatchedAccordionRouter adds /by-category, /reject, /bulk-associate — no conflict with above
app.route('/api/admin/unmatched-listings', unmatchedAccordionRouter);
app.route('/api/admin/presets', adminPresetsRouter);
app.route('/api/admin/keyword-rules', keywordRulesRouter);

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
// AppError instances return their own status code. All others return 500.

app.onError((err, c) => {
  if (err instanceof AppError) {
    return c.json(err.toJSON(), err.statusCode);
  }

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

// ── Static file serving (production only) ────────────────────────────────────
// Enabled when NODE_ENV=production and SERVE_STATIC=true.
// Serves the admin panel at /admin and the frontend at /.
// In development, Vite dev servers handle this instead.
//
// Paths are relative to the backend's dist output directory (apps/backend/dist/).
// The monorepo build copies admin/dist and frontend/dist there.

if (process.env.NODE_ENV === 'production' && process.env.SERVE_STATIC === 'true') {
  // Admin panel — must be mounted before the frontend catch-all
  app.use('/admin/*', serveStatic({ root: '../admin/dist' }));
  // Frontend SPA
  app.use('/*', serveStatic({ root: '../frontend/dist' }));
  // SPA fallback — serve index.html for any unmatched path (client-side routing)
  app.use('/*', serveStatic({ path: '../frontend/dist/index.html' }));
}

export { app };
