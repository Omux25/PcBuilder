import { Hono } from 'hono';
import { CompatibilityController } from './controllers/compatibilityController.js';

const controller = new CompatibilityController();

const compatibilityRouter = new Hono()
  .post('/validate', (c) => controller.validate(c));

export { compatibilityRouter };
