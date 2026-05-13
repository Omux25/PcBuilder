/**
 * Health check route
 *
 * GET /api/health — returns 200 with status and timestamp
 * Used by load balancers and uptime monitors.
 *
 * Checks:
 * - Server is running (always passes if this route responds)
 * - Database connectivity (SELECT 1 ping)
 *
 * Requirements: 12.2
 */

import { Hono } from 'hono';
import { getSql } from '../../core/db/index.js';

const healthRouter = new Hono();

healthRouter.get('/', async (c) => {
  let dbStatus: 'ok' | 'error' = 'ok';
  let dbError: string | undefined;

  try {
    const sql = getSql();
    await sql`SELECT 1`;
  } catch (err) {
    dbStatus = 'error';
    dbError = err instanceof Error ? err.message : String(err);
  }

  const healthy = dbStatus === 'ok';

  return c.json(
    {
      status: healthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      checks: {
        database: dbStatus,
        ...(dbError ? { database_error: dbError } : {}),
      },
    },
    200, // Always 200 — let monitoring tools interpret the status field
  );
});

export { healthRouter };
