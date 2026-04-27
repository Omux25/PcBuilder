/**
 * Scheduler — runs scraping sessions per-retailer based on their configured interval.
 * Skips retailers where is_active = false.
 *
 * Requirements: 4.2, 4.4, 6.6, 9.1, 9.2
 */

import { sql } from 'bun';
import { logger } from './utils/logger.js';
import { aggregate } from './aggregator.js';
import { Site1Scraper } from './scrapers/site1Scraper.js';
import { Site2Scraper } from './scrapers/site2Scraper.js';
import type { ScrapedPrice } from './scrapers/baseScraper.js';

// ── Scraping session ──────────────────────────────────────────────────────────

export async function runScrapingSession(): Promise<void> {
  await logger.info('Scraping session started');

  const allPrices: ScrapedPrice[] = [];

  // ── Site 1 ──────────────────────────────────────────────────────────────────
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

  // ── Site 2 ──────────────────────────────────────────────────────────────────
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

  // ── Aggregate ────────────────────────────────────────────────────────────────
  const { updated, unmatched, errors } = await aggregate(allPrices);

  await logger.info(
    `Session complete: ${updated} updated, ${unmatched} unmatched, ${errors} error(s)`,
  );
}

// ── Per-retailer interval check ───────────────────────────────────────────────

/**
 * Checks which active retailers are due for a scrape based on their
 * scraping_interval_hours setting, then runs a session for each.
 * Called by the cron job every hour.
 */
async function runDueRetailers(): Promise<void> {
  let retailers: { id: number; name: string; scraping_interval_hours: number }[];

  try {
    retailers = await sql`
      SELECT id, name, scraping_interval_hours
      FROM retailers
      WHERE is_active = true
        AND (
          last_scrape_at IS NULL
          OR last_scrape_at < NOW() - (scraping_interval_hours || ' hours')::INTERVAL
        )
    `;
  } catch (err) {
    await logger.error(`Failed to query retailers for scheduling: ${(err as Error).message}`);
    return;
  }

  if (retailers.length === 0) return;

  await logger.info(`Scheduler: ${retailers.length} retailer(s) due for scraping`);
  await runScrapingSession();
}

// ── Cron schedule ─────────────────────────────────────────────────────────────
// Check every hour which retailers are due — respects per-retailer intervals.

Bun.cron('0 * * * *', runDueRetailers);

console.log('Scraper scheduler started — checks for due retailers every hour.');
