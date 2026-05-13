/**
 * Consolidated Unmatched Listings routes
 */

import { Hono } from 'hono';
import { authMiddleware } from '../../../core/middleware/auth.js';
import { UnmatchedController } from './controllers/unmatchedController.js';

const unmatchedRouter = new Hono();
const controller = new UnmatchedController();

unmatchedRouter.use('/*', authMiddleware);

// --- Base routes ---
unmatchedRouter.get('/', (c) => controller.index(c));
unmatchedRouter.post('/:id/link', (c) => controller.link(c));
unmatchedRouter.post('/:id/dismiss', (c) => controller.dismiss(c));
unmatchedRouter.patch('/:id/category', (c) => controller.updateCategory(c));

// --- Suggestion & Accordion routes ---
unmatchedRouter.get('/grouped', (c) => controller.getGrouped(c));
unmatchedRouter.get('/by-category', (c) => controller.getByCategory(c));
unmatchedRouter.post('/reprocess', (c) => controller.reprocess(c));
unmatchedRouter.post('/auto-build', (c) => controller.autoBuild(c));
unmatchedRouter.post('/bulk-dismiss', (c) => controller.bulkDismiss(c));
unmatchedRouter.post('/bulk-approve', (c) => controller.bulkApprove(c));
unmatchedRouter.post('/bulk-associate', (c) => controller.bulkAssociate(c));
unmatchedRouter.post('/reject', (c) => controller.reject(c));
unmatchedRouter.post('/create-and-link', (c) => controller.createAndLink(c));

export { unmatchedRouter };
