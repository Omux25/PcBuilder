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
import { authRouter } from './modules/auth/auth.routes.js';
import { catalogRouter, adminCatalogRouter } from './modules/catalog/catalog.routes.js';
import { buildsRouter, adminBuildsRouter } from './modules/builds/builds.routes.js';
import { compatibilityRouter } from './modules/builds/compatibility.routes.js';
import { healthRouter } from './modules/health/health.routes.js';
import { adminRouter } from './modules/admin/admin.routes.js';
import { scrapingRouter } from './modules/scraping/scraping.routes.js';
import { unmatchedRouter } from './modules/scraping/unmatched/unmatched.routes.js';
import { rulesRouter } from './modules/scraping/rules/rules.routes.js';
import { AppError } from './core/errors/errors.js';

const app = new Hono();

// ── Security Headers ─────────────────────────────────────────────────────────
app.use('*', secureHeaders());

// ── Request logging ──────────────────────────────────────────────────────────
app.use('*', logger());

// ── Prevent browser caching on admin APIs ────────────────────────────────────
app.use('/api/admin/*', async (c, next) => {
  c.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  c.header('Pragma', 'no-cache');
  c.header('Expires', '0');
  await next();
});

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

const routes = app
  // ── Public routes ─────────────────────────────────────────────────────────────
  .route('/api/auth', authRouter)
  .route('/api/builds', buildsRouter)
  .route('/api/compatibility', compatibilityRouter)
  .route('/api', catalogRouter)
  .route('/api/health', healthRouter)
  // ── Protected routes ──────────────────────────────────────────────────────────
  .route('/api/admin', adminRouter)
  .route('/api/admin', adminCatalogRouter)
  .route('/api/admin', adminBuildsRouter)
  .route('/api/admin/scrapers', scrapingRouter)
  .route('/api/admin/unmatched-listings', unmatchedRouter)
  .route('/api/admin/keyword-rules', rulesRouter);

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
        message: err instanceof Error ? err.message : 'An unexpected error occurred',
        stack: err instanceof Error ? err.stack : undefined,
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
  app.use('/admin/*', serveStatic({ root: './admin/dist' }));
  // Frontend SPA
  app.use('/*', serveStatic({ root: './frontend/dist' }));
  // SPA fallback — serve index.html for any unmatched path (client-side routing)
  app.use('/*', serveStatic({ path: './frontend/dist/index.html' }));
}

export type AppRouter = typeof routes;
export { app };
