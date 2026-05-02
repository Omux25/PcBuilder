/**
 * Admin dashboard route
 *
 * GET /api/admin/dashboard — returns platform stats, price chart, recent activity
 *
 * Requirements: 7.1, 7.2, 7.3
 */

import { Hono } from 'hono';
import { authMiddleware } from '../../middleware/auth.js';
import { getDashboardData } from '../../services/adminService.js';

const adminDashboardRouter = new Hono();

adminDashboardRouter.use('/*', authMiddleware);

adminDashboardRouter.get('/', async (c) => {
  const data = await getDashboardData();
  return c.json(data);
});

export { adminDashboardRouter };
