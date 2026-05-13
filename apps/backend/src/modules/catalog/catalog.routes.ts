import { Hono } from 'hono';
import { authMiddleware } from '../../core/middleware/auth.js';
import { validateComponent } from '../../core/middleware/validate.js';
import { ComponentController } from './controllers/componentController.js';
import { RetailerController } from './controllers/retailerController.js';
import { MarketTrendsController } from './controllers/marketTrendsController.js';

const catalogRouter = new Hono();
const componentController = new ComponentController();
const retailerController = new RetailerController();
const trendsController = new MarketTrendsController();

// --- Public Routes ---
catalogRouter.get('/components', (c) => componentController.getComponents(c));
catalogRouter.post('/components/smart-search', (c) => componentController.smartSearch(c));
catalogRouter.get('/components/slug/:slug', (c) => componentController.getComponentBySlug(c));
catalogRouter.get('/components/:id', (c) => componentController.getComponentById(c));
catalogRouter.get('/components/:id/prices', (c) => componentController.getPrices(c));
catalogRouter.get('/components/:id/price-history', (c) => componentController.getPriceHistory(c));
catalogRouter.get('/market-trends', (c) => trendsController.getTrends(c));

// --- Admin Routes ---
// Note: In app.ts these are mounted under /api/admin
const adminRouter = new Hono();
adminRouter.use('/*', authMiddleware);

adminRouter.get('/components', (c) => componentController.getAdminComponents(c));
adminRouter.post('/components', validateComponent, (c) => componentController.createComponent(c));
adminRouter.put('/components/:id', validateComponent, (c) => componentController.updateComponent(c));
adminRouter.delete('/components/:id', (c) => componentController.deleteComponent(c));
adminRouter.post('/components/:id/deactivate', (c) => componentController.deactivateComponent(c));
adminRouter.post('/components/:id/activate', (c) => componentController.activateComponent(c));
adminRouter.post('/components/:id/unlink', (c) => componentController.unlinkComponent(c));
adminRouter.post('/components/import', (c) => componentController.importComponents(c));

adminRouter.get('/retailers', (c) => retailerController.index(c));
adminRouter.post('/retailers', (c) => retailerController.create(c));
adminRouter.put('/retailers/:id', (c) => retailerController.update(c));
adminRouter.delete('/retailers/:id', (c) => retailerController.delete(c));
adminRouter.delete('/retailers/:id/hard', (c) => retailerController.hardDelete(c));

export { catalogRouter, adminRouter as adminCatalogRouter };
