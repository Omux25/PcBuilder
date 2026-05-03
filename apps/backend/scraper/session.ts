/**
 * Scraping session — the core scraping logic, separated from the cron scheduler.
 * Manages the execution of multiple scrapers with concurrency control.
 *
 * Requirements: 6.6, 9.1, 9.2
 */

import PQueue from 'p-queue';
import { logger } from './utils/logger.js';
import { aggregate } from './aggregator.js';
import { autoMap } from './autoMapper.js';
import { buildFromUnmatched } from './catalogBuilder.js';
import { getSql } from '../src/db/index.js';
import { RETAILER_SCRAPERS } from './config/retailers.config.js';
import type { ScrapedPrice } from './scrapers/baseScraper.js';

/**
 * Runs a full or partial scraping session.
 *
 * @param targetRetailerId - If provided, only run the scraper for this specific retailer.
 */
export async function runScrapingSession(targetRetailerId?: number): Promise<void> {
  const sessionType = targetRetailerId ? `Targeted (Retailer ${targetRetailerId})` : 'Full';
  await logger.info(`Scraping session started: ${sessionType}`);

  const allPrices: ScrapedPrice[] = [];

  // Initialize concurrency queue (limit to 2 to avoid overwhelming resources/getting blocked)
  const queue = new PQueue({ concurrency: 2 });

  // Filter scrapers based on targetRetailerId
  const scrapersToRun = targetRetailerId
    ? RETAILER_SCRAPERS.filter(s => s.retailer_id === targetRetailerId)
    : RETAILER_SCRAPERS;

  if (scrapersToRun.length === 0 && targetRetailerId) {
    await logger.warn(`No scraper found for retailer ID ${targetRetailerId}`);
    return;
  }

  // Track per-retailer success/failure for status updates
  const scraperResults = new Map<number, 'SUCCESS' | 'FAILED'>();

  await Promise.all(scrapersToRun.map(config =>
    queue.add(async () => {
      try {
        await logger.info(`Starting ${config.name} scraper...`);
        const prices = await config.run();
        allPrices.push(...prices);
        await logger.info(`${config.name}: scraped ${prices.length} price(s)`);
        scraperResults.set(config.retailer_id, 'SUCCESS');
      } catch (err) {
        await logger.error(
          `${config.name} scraping failed: ${err instanceof Error ? err.message : String(err)}`,
          config.name
        );
        scraperResults.set(config.retailer_id, 'FAILED');
      }
    })
  ));

  // Update last_scrape_at and last_scrape_status for each retailer
  const sql = getSql();
  for (const [retailerId, status] of scraperResults) {
    try {
      await sql`
        UPDATE retailers
        SET last_scrape_at = NOW(), last_scrape_status = ${status}
        WHERE id = ${retailerId}
      `;
    } catch { /* non-critical */ }
  }

  if (allPrices.length === 0) {
    await logger.info('Session complete: 0 updated, 0 unmatched, 0 error(s)');
    return;
  }

  // ── Data Processing Phase ──────────────────────────────────────────────────

  const { updated, unmatched, errors } = await aggregate(allPrices);

  const { mapped: autoMapped } = await autoMap();
  const { created: autoCatalog } = await buildFromUnmatched();

  let secondPassMapped = 0;
  if (autoCatalog > 0) {
    const second = await autoMap();
    secondPassMapped = second.mapped;
  }

  await logger.info(
    `Session complete: ${updated} updated, ${unmatched} unmatched, ${errors} error(s)` +
    (autoMapped + secondPassMapped > 0 ? `, ${autoMapped + secondPassMapped} auto-mapped` : '') +
    (autoCatalog > 0 ? `, ${autoCatalog} new catalog entries` : ''),
  );
}
