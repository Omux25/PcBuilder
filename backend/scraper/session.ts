/**
 * Scraping session — the core scraping logic, separated from the cron scheduler.
 * Import this file to trigger a session without starting the cron job.
 *
 * Requirements: 6.6, 9.1, 9.2
 */

import { logger } from './utils/logger.js';
import { aggregate } from './aggregator.js';
import { Site1Scraper } from './scrapers/site1Scraper.js';
import { Site2Scraper } from './scrapers/site2Scraper.js';
import type { ScrapedPrice } from './scrapers/baseScraper.js';

export async function runScrapingSession(): Promise<void> {
  await logger.info('Scraping session started');

  const allPrices: ScrapedPrice[] = [];

  const site1 = new Site1Scraper();
  try {
    const prices = await site1.scrapeListingPage();
    allPrices.push(...prices);
    await logger.info(`Site1: scraped ${prices.length} price(s)`, site1.siteName);
  } catch (err) {
    await logger.error(
      `Site1 scraping failed: ${err instanceof Error ? err.message : String(err)}`,
      site1.siteName,
    );
  }

  const site2 = new Site2Scraper();
  try {
    const prices = await site2.scrapeAllProducts();
    allPrices.push(...prices);
    await logger.info(`Site2: scraped ${prices.length} price(s)`, site2.siteName);
  } catch (err) {
    await logger.error(
      `Site2 scraping failed: ${err instanceof Error ? err.message : String(err)}`,
      site2.siteName,
    );
  }

  const { updated, unmatched, errors } = await aggregate(allPrices);

  await logger.info(
    `Session complete: ${updated} updated, ${unmatched} unmatched, ${errors} error(s)`,
  );
}
