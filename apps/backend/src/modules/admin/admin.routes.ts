/**
 * Admin Routes — Unified router for all admin-related endpoints.
 */

import { Hono } from 'hono';
import { authMiddleware } from '../../core/middleware/auth.js';
import { AdminController } from './controllers/adminController.js';

const adminController = new AdminController();

const adminRouter = new Hono()
  .use('/*', authMiddleware)
  .get('/dashboard', (c) => adminController.getDashboardData(c))
  .get('/logs', (c) => adminController.getLogs(c))
  .delete('/logs', (c) => adminController.deleteLogs(c));

export { adminRouter };
