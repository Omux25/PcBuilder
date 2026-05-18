/**
 * Scraping Routes — Handles status, run-all, per-retailer run, and scrape-urls.
 */

import { Hono } from 'hono';
import { authMiddleware } from '../../core/middleware/auth.js';
import { ScrapingController } from './controllers/scrapingController.js';

const controller = new ScrapingController();

const scrapingRouter = new Hono()
  .use('/*', authMiddleware)
  .get('/status', (c) => controller.getStatus(c))
  .post('/run-all', (c) => controller.runAll(c))
  .post('/:retailerId/run', (c) => controller.runRetailer(c))
  .post('/scrape-urls', (c) => controller.scrapeUrls(c));

export { scrapingRouter };
