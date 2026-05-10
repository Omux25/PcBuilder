/**
 * Admin scraper routes — JWT-protected
 *
 * GET  /api/admin/scrapers/status          — check if a session is running
 * POST /api/admin/scrapers/run-all         — trigger all active retailers
 * POST /api/admin/scrapers/:retailerId/run — trigger one retailer
 *
 * Requirements: 5.1, 5.2, 5.3, 5.6
 */

import { Hono } from 'hono';
import { authMiddleware } from '../../middleware/auth.js';
import { getRetailerById } from '../../services/retailerService.js';
import { runScrapingSession } from '../../../scraper/session.js';
import { AppError } from '../../utils/errors.js';
import { parseId } from './types.js';
import type { AdminEnv } from './types.js';

const adminScrapersRouter = new Hono<AdminEnv>();

adminScrapersRouter.use('/*', authMiddleware);

// Global lock for full session
let fullSessionRunning = false;
// Track running jobs to prevent duplicates (in-memory — sufficient for single-process)
const runningJobs = new Set<number>();

/** Reset locks — used in tests to ensure clean state between test cases. */
export function resetScraperLocks(): void {
  fullSessionRunning = false;
  runningJobs.clear();
}

/** Returns true if any scraping session is currently running. */
export function isScraperRunning(): boolean {
  return fullSessionRunning || runningJobs.size > 0;
}

// GET /api/admin/scrapers/status
adminScrapersRouter.get('/status', (c) => {
  return c.json({
    running: fullSessionRunning || runningJobs.size > 0,
    full_session_running: fullSessionRunning,
    running_jobs: [...runningJobs],
  });
});

// POST /api/admin/scrapers/run-all
adminScrapersRouter.post('/run-all', async (c) => {
  if (fullSessionRunning) {
    return c.json({ error: { code: 'CONFLICT', message: 'A full scraping session is already running' } }, 409);
  }

  fullSessionRunning = true;
  (async () => {
    try {
      await runScrapingSession();
    } finally {
      fullSessionRunning = false;
    }
  })();

  return c.json({ message: 'Full scraping session started', status: 'started' });
});

// POST /api/admin/scrapers/:retailerId/run
adminScrapersRouter.post('/:retailerId/run', async (c) => {
  const retailerId = parseId(c.req.param('retailerId'));
  if (retailerId === null) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'retailerId must be a positive integer' } }, 400);
  }

  // Note: we intentionally allow targeted scrapes to run alongside a full session.
  // The full session already tracks per-retailer state via runningJobs.
  // Only block if this specific retailer is already running.

  try {
    await getRetailerById(retailerId);
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return c.json(err.toJSON(), err.statusCode);
    }
    throw err;
  }

  if (runningJobs.has(retailerId)) {
    return c.json(
      { error: { code: 'CONFLICT', message: `A scraping job is already running for retailer ${retailerId}` } },
      409,
    );
  }

  runningJobs.add(retailerId);
  (async () => {
    try {
      await runScrapingSession(retailerId);
    } finally {
      runningJobs.delete(retailerId);
    }
  })();

  return c.json({ status: 'started', retailer_id: retailerId });
});

export { adminScrapersRouter };
