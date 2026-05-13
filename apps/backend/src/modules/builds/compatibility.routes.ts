import { Hono } from 'hono';
import { CompatibilityController } from './controllers/compatibilityController.js';

const compatibilityRouter = new Hono();
const controller = new CompatibilityController();

compatibilityRouter.post('/validate', (c) => controller.validate(c));

export { compatibilityRouter };
