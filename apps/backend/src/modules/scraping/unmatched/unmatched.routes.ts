/**
 * Consolidated Unmatched Listings routes
 */

import { Hono } from 'hono';
import { authMiddleware } from '../../../core/middleware/auth.js';
import { UnmatchedController } from './controllers/unmatchedController.js';

const controller = new UnmatchedController();

const unmatchedRouter = new Hono()
  .use('/*', authMiddleware)
  .get('/', (c) => controller.index(c))
  .post('/:id/link', (c) => controller.link(c))
  .post('/:id/dismiss', (c) => controller.dismiss(c))
  .patch('/:id/category', (c) => controller.updateCategory(c))
  .get('/grouped', (c) => controller.getGrouped(c))
  .get('/by-category', (c) => controller.getByCategory(c))
  .post('/reprocess', (c) => controller.reprocess(c))
  .post('/auto-build', (c) => controller.autoBuild(c))
  .post('/bulk-dismiss', (c) => controller.bulkDismiss(c))
  .post('/bulk-approve', (c) => controller.bulkApprove(c))
  .post('/bulk-associate', (c) => controller.bulkAssociate(c))
  .post('/reject', (c) => controller.reject(c))
  .post('/bulk-category', (c) => controller.bulkCategory(c))
  .post('/bulk-confirm-categories', (c) => controller.bulkConfirmCategories(c))
  .post('/create-and-link', (c) => controller.createAndLink(c));

export { unmatchedRouter };
