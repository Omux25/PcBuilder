/**
 * Admin dashboard route
 *
 * GET /api/admin/dashboard — returns platform stats, price chart, recent activity
 *
 * Requirements: 7.1, 7.2, 7.3
 */

import { Hono } from 'hono';
import { authMiddleware } from '../../middleware/auth.js';
import { getDashboardStats, getPriceUpdatesChart, getRecentActivity } from '../../services/adminService.js';

const adminDashboardRouter = new Hono();

adminDashboardRouter.get('/', authMiddleware, async (c) => {
  const [stats, priceChart, recentActivity] = await Promise.all([
    getDashboardStats(),
    getPriceUpdatesChart(30),
    getRecentActivity(10),
  ]);

  return c.json({ stats, price_updates_chart: priceChart, recent_activity: recentActivity });
});

export { adminDashboardRouter };
