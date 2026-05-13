/**
 * Admin keyword rules routes — JWT-protected
 */

import { Hono } from 'hono';
import { authMiddleware } from '../../../core/middleware/auth.js';
import { KeywordRuleController } from './controllers/keywordRuleController.js';

const rulesRouter = new Hono();
const controller = new KeywordRuleController();

rulesRouter.use('/*', authMiddleware);

// GET /
rulesRouter.get('/', (c) => controller.getRules(c));

// POST /preview
rulesRouter.post('/preview', (c) => controller.preview(c));

// POST /
rulesRouter.post('/', (c) => controller.createRule(c));

// DELETE /:id
rulesRouter.delete('/:id', (c) => controller.deleteRule(c));

export { rulesRouter };

