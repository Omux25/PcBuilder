/**
 * Admin scraper routes — JWT-protected
 *
 * POST /api/admin/scrapers/run-all         — trigger all active retailers
 * POST /api/admin/scrapers/:retailerId/run — trigger one retailer
 *
 * Requirements: 5.1, 5.2, 5.3, 5.6
 */

import { Hono } from 'hono';
import { authMiddleware } from '../../middleware/auth.js';
import { getRetailers, getRetailerById } from '../../services/retailerService.js';
import { runScrapingSession } from '../../../scraper/session.js';
import { AppError } from '../../utils/errors.js';

const adminScrapersRouter = new Hono();

adminScrapersRouter.use('/*', authMiddleware);

// Track running jobs to prevent duplicates (in-memory — sufficient for single-process)
const runningJobs = new Set<number>();

// POST /api/admin/scrapers/run-all
adminScrapersRouter.post('/run-all', async (c) => {
  const retailers = await getRetailers(false); // active only

  const jobIds: string[] = [];
  for (const retailer of retailers) {
    if (runningJobs.has(retailer.id)) continue;

    const jobId = `scrape-${retailer.id}-${Date.now()}`;
    jobIds.push(jobId);

    runningJobs.add(retailer.id);
    (async () => {
      try {
        await runScrapingSession();
      } finally {
        runningJobs.delete(retailer.id);
      }
    })();
  }

  return c.json({ message: 'Scraping jobs started', job_ids: jobIds, retailers_count: jobIds.length });
});

// POST /api/admin/scrapers/:retailerId/run
adminScrapersRouter.post('/:retailerId/run', async (c) => {
  const retailerId = Number(c.req.param('retailerId'));
  if (!Number.isInteger(retailerId) || retailerId <= 0) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'retailerId must be a positive integer' } }, 400);
  }

  try {
    await getRetailerById(retailerId);
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return c.json(err.toJSON(), err.statusCode as any);
    }
    throw err;
  }

  if (runningJobs.has(retailerId)) {
    return c.json(
      { error: { code: 'CONFLICT', message: `A scraping job is already running for retailer ${retailerId}` } },
      409,
    );
  }

  const jobId = `scrape-${retailerId}-${Date.now()}`;

  runningJobs.add(retailerId);
  (async () => {
    try {
      await runScrapingSession();
    } finally {
      runningJobs.delete(retailerId);
    }
  })();

  return c.json({ job_id: jobId, status: 'started', retailer_id: retailerId });
});

export { adminScrapersRouter };
