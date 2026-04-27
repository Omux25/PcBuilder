/**
 * Scheduler — runs the full scraping session every 24 hours via Bun.cron().
 *
 * Wires together: scrapers → aggregator → logger.
 *
 * Flow per session:
 *   1. Log session start
 *   2. Run each scraper inside try/catch — one failure never stops the rest
 *   3. Collect all ScrapedPrice[] results
 *   4. Pass everything to the aggregator (UPSERT into prices table)
 *   5. Log session complete with summary
 *
 * To start the scheduler, import this file:
 *   import './scraper/scheduler.js';
 *
 * Or run it standalone:
 *   bun scraper/scheduler.ts
 *
 * Requirements: 6.6, 9.1, 9.2
 */

import { logger } from './utils/logger.js';
import { aggregate } from './aggregator.js';
import { Site1Scraper } from './scrapers/site1Scraper.js';
import { Site2Scraper } from './scrapers/site2Scraper.js';
import type { ScrapedPrice } from './scrapers/baseScraper.js';

// ── Scraping session ──────────────────────────────────────────────────────────

/**
 * Runs one full scraping session:
 * - Calls each scraper
 * - Collects results
 * - Aggregates into the DB
 * - Logs start, per-scraper errors, and final summary
 *
 * Exported so it can be called directly in tests or triggered manually.
 */
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
  const { updated, errors } = await aggregate(allPrices);

  await logger.info(
    `Session complete: ${updated} price(s) updated, ${errors} error(s)`,
  );
}

// ── Cron schedule ─────────────────────────────────────────────────────────────

/**
 * Schedules the scraping session to run every day at midnight.
 * Bun.cron() is built into Bun 1.3+ — no external package needed.
 *
 * Cron expression: '0 0 * * *'
 *   ┌── minute (0)
 *   │  ┌── hour (0 = midnight)
 *   │  │  ┌── day of month (*)
 *   │  │  │  ┌── month (*)
 *   │  │  │  │  ┌── day of week (*)
 *   0  0  *  *  *
 */
Bun.cron('0 0 * * *', runScrapingSession);

console.log('Scraper scheduler started — runs daily at midnight.');
