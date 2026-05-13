/**
 * Scraping Controller — Handles scraping status and manual trigger requests.
 */

import { Context } from 'hono';
import { ScrapingService } from '../services/scrapingService.js';

export class ScrapingController {
  private service = new ScrapingService();

  getStatus(c: Context) {
    return c.json(ScrapingService.getStatus());
  }

  async runAll(c: Context) {
    await this.service.runFullSession();
    return c.json({ message: 'Full scraping session started', status: 'started' });
  }

  async runRetailer(c: Context) {
    const retailerId = parseInt(c.req.param('retailerId'), 10);
    if (isNaN(retailerId)) {
      return c.json({ error: { code: 'VALIDATION_ERROR', message: 'retailerId must be a positive integer' } }, 400);
    }

    await this.service.runRetailerSession(retailerId);
    return c.json({ status: 'started', retailer_id: retailerId });
  }

  async scrapeUrls(c: Context) {
    let body: any;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' } }, 400);
    }

    const urls = body.urls;
    if (!Array.isArray(urls) || urls.length === 0) {
      return c.json({ error: { code: 'VALIDATION_ERROR', message: 'urls must be a non-empty array' } }, 400);
    }

    const result = await this.service.scrapeUrls(urls);
    return c.json(result);
  }
}
