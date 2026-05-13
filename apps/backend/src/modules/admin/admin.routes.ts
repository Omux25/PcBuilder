/**
 * Admin Routes — Unified router for all admin-related endpoints.
 */

import { Hono } from 'hono';
import { authMiddleware } from '../../core/middleware/auth.js';
import { AdminController } from './controllers/adminController.js';

const adminRouter = new Hono();
const adminController = new AdminController();

// All admin routes require JWT authentication
adminRouter.use('/*', authMiddleware);

// Dashboard
adminRouter.get('/dashboard', (c) => adminController.getDashboardData(c));

// Logs
adminRouter.get('/logs', (c) => adminController.getLogs(c));
adminRouter.delete('/logs', (c) => adminController.deleteLogs(c));

export { adminRouter };
