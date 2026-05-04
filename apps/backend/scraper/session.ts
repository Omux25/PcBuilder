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
import { runSuggestionPreprocessing } from '../src/services/suggestionPreprocessor.js';
import { getSql } from '../src/db/index.js';
import { RETAILER_SCRAPERS } from './config/retailers.config.js';
import { importBenchmarks } from './benchmarkImporter.js';
import type { ScrapedPrice } from './scrapers/baseScraper.js';

/**
 * Runs a full or partial scraping session.
 *
 * @param targetRetailerId - If provided, only run the scraper for this specific retailer.
 */
export async function runScrapingSession(targetRetailerId?: number): Promise<void> {
  const targetName = targetRetailerId
    ? RETAILER_SCRAPERS.find(s => s.retailer_id === targetRetailerId)?.name ?? `Retailer ${targetRetailerId}`
    : 'Full';
  const sessionType = targetRetailerId ? `Targeted (${targetName})` : 'Full';
  await logger.info(`[SESSION] Scraping session started: ${sessionType}`);

  const allPrices: ScrapedPrice[] = [];
  const queue = new PQueue({ concurrency: 2 });

  const scrapersToRun = targetRetailerId
    ? RETAILER_SCRAPERS.filter(s => s.retailer_id === targetRetailerId)
    : RETAILER_SCRAPERS;

  if (scrapersToRun.length === 0 && targetRetailerId) {
    await logger.warn(`[SESSION] No scraper registered for retailer ID ${targetRetailerId}`);
    return;
  }

  const scraperResults = new Map<number, 'SUCCESS' | 'FAILED'>();

  await Promise.all(scrapersToRun.map(config =>
    queue.add(async () => {
      try {
        await logger.info(`[${config.name}] Scraper started`, config.name);
        const prices = await config.run();
        allPrices.push(...prices);
        await logger.info(`[${config.name}] Successfully scraped ${prices.length} product(s)`, config.name);
        scraperResults.set(config.retailer_id, 'SUCCESS');
      } catch (err) {
        await logger.error(
          `[${config.name}] Scraper failed: ${err instanceof Error ? err.message : String(err)}`,
          config.name
        );
        scraperResults.set(config.retailer_id, 'FAILED');
      }
    })
  ));

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
    await logger.info('[SESSION] Scraping complete: 0 updated, 0 unmatched, 0 errors');
    return;
  }

  await logger.info(`[SESSION] Matching ${allPrices.length} listing(s) to catalog...`);
  const { updated, unmatched, errors } = await aggregate(allPrices);

  await logger.info(`[SESSION] Auto-mapping unmatched listings...`);
  const { mapped: autoMapped } = await autoMap();

  await logger.info(`[SESSION] Building catalog entries from unmatched items...`);
  const { created: autoCatalog } = await buildFromUnmatched();

  let secondPassMapped = 0;
  if (autoCatalog > 0) {
    const second = await autoMap();
    secondPassMapped = second.mapped;
  }

  // Pre-compute suggestions for all remaining pending listings
  await runSuggestionPreprocessing();

  const summary = [
    `${updated} updated`,
    `${unmatched} unmatched`,
    `${errors} error(s)`,
    ...(autoMapped + secondPassMapped > 0 ? [`${autoMapped + secondPassMapped} auto-mapped`] : []),
    ...(autoCatalog > 0 ? [`${autoCatalog} new catalog entries`] : []),
  ].join(', ');

  await logger.info(`[SESSION] Scraping complete: ${summary}`);

  // Auto-update benchmark scores after each session — keeps scores current
  // as new components are added to the catalog by the catalog builder.
  try {
    const { updated: bUpdated } = await importBenchmarks();
    if (bUpdated > 0) {
      await logger.info(`[BENCHMARKS] Updated ${bUpdated} component score(s)`);
    }
  } catch { /* non-critical — benchmark import failure must not crash the session */ }
}
