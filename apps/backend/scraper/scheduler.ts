/**
 * Scheduler — registers the Bun.cron() job that triggers scraping sessions.
 *
 * Call startScheduler() explicitly from server.ts to start the cron job.
 * This prevents the scheduler from auto-starting when the file is imported
 * in tests or other non-server contexts (P145).
 *
 * Requirements: 4.2, 4.4
 */

import { logger } from './utils/logger.js';
import { runScrapingSession } from './session.js';
import { getSql } from '../src/db/index.js';

// ── Mutex ─────────────────────────────────────────────────────────────────────
// Prevents concurrent scraping sessions if the cron fires while a previous
// session is still running (P148).

let sessionRunning = false;

async function runDueRetailers(): Promise<void> {
  // Guard: skip if a session is already in progress
  if (sessionRunning) {
    await logger.warn('[SCHEDULER] Skipping scheduled run — a session is already running');
    return;
  }

  let retailers: { id: number; name: string; scraping_interval_hours: number }[];

  try {
    const sql = getSql();
    // Use parameterized interval calculation to avoid string concatenation (P147)
    retailers = await sql`
      SELECT id, name, scraping_interval_hours
      FROM retailers
      WHERE is_active = true
        AND scraping_enabled = true
        AND (
          last_scrape_at IS NULL
          OR last_scrape_at < NOW() - (scraping_interval_hours * INTERVAL '1 hour')
        )
    `;
  } catch (err) {
    await logger.error(`Failed to query retailers for scheduling: ${(err as Error).message}`);
    return;
  }

  if (retailers.length === 0) return;

  await logger.info(`[SCHEDULER] ${retailers.length} retailer(s) due for scraping`);

  sessionRunning = true;
  try {
    await runScrapingSession();
  } catch (err) {
    await logger.error(`[SCHEDULER] Session failed: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    sessionRunning = false;
  }
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

let cronHandle: ReturnType<typeof Bun.cron> | null = null;

/**
 * Starts the hourly cron job. Safe to call multiple times — subsequent calls
 * are no-ops if the scheduler is already running.
 */
export function startScheduler(): void {
  if (cronHandle) return; // already started
  cronHandle = Bun.cron('0 * * * *', runDueRetailers);
  console.log('Scraper scheduler started — checks for due retailers every hour.');
}

/**
 * Stops the cron job. Used for graceful shutdown.
 */
export function stopScheduler(): void {
  if (cronHandle) {
    cronHandle.unref?.();
    cronHandle = null;
    console.log('Scraper scheduler stopped.');
  }
}

export { runScrapingSession };
