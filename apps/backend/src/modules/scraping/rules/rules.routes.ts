/**
 * Admin keyword rules routes — JWT-protected
 */

import { Hono } from 'hono';
import { authMiddleware } from '../../../core/middleware/auth.js';
import { KeywordRuleController } from './controllers/keywordRuleController.js';

const controller = new KeywordRuleController();

const rulesRouter = new Hono()
  .use('/*', authMiddleware)
  .get('/', (c) => controller.getRules(c))
  .post('/preview', (c) => controller.preview(c))
  .post('/', (c) => controller.createRule(c))
  .delete('/:id', (c) => controller.deleteRule(c));

export { rulesRouter };
