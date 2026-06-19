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

import { authRouter } from './modules/auth/auth.routes.js';
import { catalogRouter, adminCatalogRouter } from './modules/catalog/catalog.routes.js';
import { buildsRouter, adminBuildsRouter, shareController } from './modules/builds/builds.routes.js';
import { compatibilityRouter } from './modules/builds/compatibility.routes.js';
import { healthRouter } from './modules/health/health.routes.js';
import { adminRouter } from './modules/admin/admin.routes.js';
import { scrapingRouter } from './modules/scraping/scraping.routes.js';
import { unmatchedRouter } from './modules/scraping/unmatched/unmatched.routes.js';
import { rulesRouter } from './modules/scraping/rules/rules.routes.js';
import { adminTrafficRouter } from './modules/admin/traffic.routes.js';
import { publicTrafficRouter } from './modules/traffic/traffic.routes.js';
import { trafficLogger } from './modules/traffic/traffic.middleware.js';
import { AppError } from './core/errors/errors.js';
import { seoRouter } from './modules/seo/seo.routes.js';

const app = new Hono();

// ── Security Headers ─────────────────────────────────────────────────────────
app.use('*', secureHeaders());

// ── Request logging ──────────────────────────────────────────────────────────
app.use('*', logger());
app.use('*', trafficLogger());

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

export function getAllowedOrigins(): string | string[] {
  const raw = process.env.ALLOWED_ORIGINS?.trim();
  if (!raw || raw === '*') {
    if (process.env.NODE_ENV === 'production') {
      console.warn('[CORS] WARNING: ALLOWED_ORIGINS is missing or set to *. In production, this restricts all cross-origin credentialed requests. Set ALLOWED_ORIGINS to a comma-separated list of valid origins.');
      return [];
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

app.get('/b/:id', (c) => shareController.redirect(c));
app.get('/share/:id', (c) => shareController.redirect(c));

const routes = app
  // ── Public routes ─────────────────────────────────────────────────────────────
  .route('/api/auth', authRouter)
  .route('/api/builds', buildsRouter)
  .route('/api/compatibility', compatibilityRouter)
  .route('/api', catalogRouter)
  .route('/api', seoRouter)
  .route('/api/ui', publicTrafficRouter)
  .route('/api/pulse', publicTrafficRouter)
  .route('/api/traffic', publicTrafficRouter)
  .route('/api/health', healthRouter)
  // ── Protected routes ──────────────────────────────────────────────────────────
  .route('/api/admin', adminRouter)
  .route('/api/admin', adminCatalogRouter)
  .route('/api/admin', adminBuildsRouter)
  .route('/api/admin/scrapers', scrapingRouter)
  .route('/api/admin/unmatched-listings', unmatchedRouter)
  .route('/api/admin/keyword-rules', rulesRouter)
  .route('/api/admin', adminTrafficRouter);

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


export type AppRouter = typeof routes;
export { app };
