import { Hono } from 'hono';
import { authMiddleware } from '../../core/middleware/auth.js';
import { PresetController } from './controllers/presetController.js';

const buildsRouter = new Hono();
const presetController = new PresetController();

// --- Public Routes ---
buildsRouter.get('/presets', (c) => presetController.index(c));
buildsRouter.get('/presets/:id', (c) => presetController.show(c));

// --- Admin Routes ---
const adminRouter = new Hono();
adminRouter.use('/*', authMiddleware);

adminRouter.get('/presets', (c) => presetController.getAdminPresets(c));
adminRouter.post('/presets', (c) => presetController.create(c));
adminRouter.put('/presets/:id', (c) => presetController.update(c));
adminRouter.delete('/presets/:id', (c) => presetController.delete(c));

export { buildsRouter, adminRouter as adminBuildsRouter };
