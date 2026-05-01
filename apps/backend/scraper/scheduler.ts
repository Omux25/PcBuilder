/**
 * Scheduler — registers the Bun.cron() job that triggers scraping sessions.
 * Importing this file starts the cron job. Do not import it from route handlers.
 *
 * Requirements: 4.2, 4.4
 */

import { sql as bunSql } from 'bun';
import { logger } from './utils/logger.js';
import { runScrapingSession } from './session.js';

async function runDueRetailers(): Promise<void> {
  let retailers: { id: number; name: string; scraping_interval_hours: number }[];

  try {
    retailers = await bunSql`
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

Bun.cron('0 * * * *', runDueRetailers);

console.log('Scraper scheduler started — checks for due retailers every hour.');

export { runScrapingSession };
