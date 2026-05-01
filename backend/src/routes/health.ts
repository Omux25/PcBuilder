/**
 * Health check route
 *
 * GET /api/health — returns 200 with status and timestamp
 * Used by load balancers and uptime monitors.
 *
 * Requirements: 12.2
 */

import { Hono } from 'hono';

const healthRouter = new Hono();

healthRouter.get('/', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

export { healthRouter };
