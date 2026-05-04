/**
 * Admin scraper URL routes — JWT-protected
 *
 * POST /api/admin/scrapers/scrape-urls
 *   Triggers a targeted scrape for specific product URLs.
 *   Used after Create & Link to immediately fetch prices for newly mapped components.
 *
 * Reuses existing scraper classes without modification — only the entry point changes.
 * Requirements: 12.2, 12.3, 12.4, 12.5, 15.9
 */

import { Hono } from 'hono';
import { authMiddleware } from '../../middleware/auth.js';
import { aggregate } from '../../../scraper/aggregator.js';
import { RETAILER_SCRAPERS } from '../../../scraper/config/retailers.config.js';
import type { ScrapedPrice } from '../../../scraper/scrapers/baseScraper.js';
import type { AdminEnv } from './types.js';

const scraperUrlsRouter = new Hono<AdminEnv>();

scraperUrlsRouter.use('/*', authMiddleware);

// POST /api/admin/scrapers/scrape-urls
// Body: { urls: Array<{ retailer_id: number; product_url: string }> }
scraperUrlsRouter.post('/scrape-urls', async (c) => {
    let body: Record<string, unknown>;
    try {
        body = await c.req.json();
    } catch {
        return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' } }, 400);
    }

    const urls = body.urls;
    if (!Array.isArray(urls) || urls.length === 0) {
        return c.json({ error: { code: 'VALIDATION_ERROR', message: 'urls must be a non-empty array' } }, 400);
    }

    // Validate each entry
    const validEntries = urls.filter(
        (u): u is { retailer_id: number; product_url: string } =>
            typeof u === 'object' &&
            u !== null &&
            Number.isInteger((u as Record<string, unknown>).retailer_id) &&
            typeof (u as Record<string, unknown>).product_url === 'string',
    );

    if (validEntries.length === 0) {
        return c.json({ error: { code: 'VALIDATION_ERROR', message: 'No valid URL entries provided' } }, 400);
    }

    // Group by retailer_id
    const byRetailer = new Map<number, string[]>();
    for (const entry of validEntries) {
        if (!byRetailer.has(entry.retailer_id)) byRetailer.set(entry.retailer_id, []);
        byRetailer.get(entry.retailer_id)!.push(entry.product_url);
    }

    const allPrices: ScrapedPrice[] = [];
    let scraped = 0;
    let failed = 0;

    // For each retailer, run the full scraper and filter to only the requested URLs.
    // This reuses the existing scraper classes without modification.
    // The scraper fetches all products; we then filter to the URLs we care about.
    for (const [retailerId, targetUrls] of byRetailer) {
        const config = RETAILER_SCRAPERS.find((s) => s.retailer_id === retailerId);
        if (!config) {
            failed += targetUrls.length;
            continue;
        }

        try {
            const prices = await config.run();
            const targetSet = new Set(targetUrls);
            const filtered = prices.filter((p) => targetSet.has(p.product_url));
            allPrices.push(...filtered);
            scraped += filtered.length;
            // Count URLs that weren't found in the scrape as failed
            failed += targetUrls.length - filtered.length;
        } catch {
            failed += targetUrls.length;
        }
    }

    // Run aggregator for the fetched prices
    if (allPrices.length > 0) {
        await aggregate(allPrices);
    }

    return c.json({ scraped, failed });
});

export { scraperUrlsRouter };
