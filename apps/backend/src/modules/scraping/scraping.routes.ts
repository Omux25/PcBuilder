/**
 * Scraping Routes — Handles status, run-all, per-retailer run, and scrape-urls.
 */

import { Hono } from 'hono';
import { authMiddleware } from '../../core/middleware/auth.js';
import { ScrapingController } from './controllers/scrapingController.js';

const scrapingRouter = new Hono();
const controller = new ScrapingController();

scrapingRouter.use('/*', authMiddleware);

scrapingRouter.get('/status', (c) => controller.getStatus(c));
scrapingRouter.post('/run-all', (c) => controller.runAll(c));
scrapingRouter.post('/:retailerId/run', (c) => controller.runRetailer(c));
scrapingRouter.post('/scrape-urls', (c) => controller.scrapeUrls(c));

export { scrapingRouter };
