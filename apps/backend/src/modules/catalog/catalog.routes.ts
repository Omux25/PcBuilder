import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { componentSchema } from '@shared/schemas/component.schema.js';
import { authMiddleware } from '../../core/middleware/auth.js';
import { ComponentController } from './controllers/componentController.js';
import { RetailerController } from './controllers/retailerController.js';
import { MarketTrendsController } from './controllers/marketTrendsController.js';

const componentController = new ComponentController();
const retailerController = new RetailerController();
const trendsController = new MarketTrendsController();

const catalogRouter = new Hono()
  .get('/components', (c) => componentController.getComponents(c))
  .post('/components/smart-search', (c) => componentController.smartSearch(c))
  .get('/components/slug/:slug', (c) => componentController.getComponentBySlug(c))
  .get('/components/:id', (c) => componentController.getComponentById(c))
  .get('/components/:id/prices', (c) => componentController.getPrices(c))
  .get('/components/:id/price-history', (c) => componentController.getPriceHistory(c))
  .get('/market-trends', (c) => trendsController.getTrends(c));

// --- Admin Routes ---
// Note: In app.ts these are mounted under /api/admin
const adminRouter = new Hono()
  .use('/*', authMiddleware)
  .get('/components', (c) => componentController.getAdminComponents(c))
  .post('/components',
    zValidator('json', componentSchema),
    (c) => componentController.createComponent(c)
  )
  .put('/components/:id',
    zValidator('json', componentSchema),
    (c) => componentController.updateComponent(c)
  )
  .delete('/components/:id', (c) => componentController.deleteComponent(c))
  .post('/components/:id/deactivate', (c) => componentController.deactivateComponent(c))
  .post('/components/:id/activate', (c) => componentController.activateComponent(c))
  .post('/components/:id/unlink', (c) => componentController.unlinkComponent(c))
  .post('/components/import', (c) => componentController.importComponents(c))
  .get('/retailers', (c) => retailerController.index(c))
  .post('/retailers', (c) => retailerController.create(c))
  .put('/retailers/:id', (c) => retailerController.update(c))
  .delete('/retailers/:id', (c) => retailerController.delete(c))
  .delete('/retailers/:id/hard', (c) => retailerController.hardDelete(c));

export { catalogRouter, adminRouter as adminCatalogRouter };
