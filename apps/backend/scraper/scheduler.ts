/**
 * Scheduler — registers the Bun.cron() job that triggers scraping sessions.
 * Importing this file starts the cron job. Do not import it from route handlers.
 *
 * Requirements: 4.2, 4.4
 */

import { logger } from './utils/logger.js';
import { runScrapingSession } from './session.js';
import { getSql } from '../src/db/index.js';

async function runDueRetailers(): Promise<void> {
  let retailers: { id: number; name: string; scraping_interval_hours: number }[];

  try {
    const sql = getSql();
    retailers = await sql`
      SELECT id, name, scraping_interval_hours
      FROM retailers
      WHERE is_active = true
        AND scraping_enabled = true
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

  await logger.info(`[SCHEDULER] ${retailers.length} retailer(s) due for scraping`);
  await runScrapingSession();
}

Bun.cron('0 * * * *', runDueRetailers);

console.log('Scraper scheduler started — checks for due retailers every hour.');

export { runScrapingSession };
