/**
 * Scraping session — the core scraping logic, separated from the cron scheduler.
 * Import this file to trigger a session without starting the cron job.
 *
 * Requirements: 6.6, 9.1, 9.2
 */

import { logger } from './utils/logger.js';
import { aggregate } from './aggregator.js';
import { autoMap } from './autoMapper.js';
import { buildFromUnmatched } from './catalogBuilder.js';
import { Site1Scraper } from './scrapers/site1Scraper.js';
import { Site2Scraper } from './scrapers/site2Scraper.js';
import { UltraPcScraper } from './scrapers/ultrapcScraper.js';
import { NextLevelScraper } from './scrapers/nextlevelScraper.js';
import { SetupGameScraper } from './scrapers/setupgameScraper.js';
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

  const ultrapc = new UltraPcScraper();
  try {
    const prices = await ultrapc.scrapeAllCategories();
    allPrices.push(...prices);
    await logger.info(`UltraPC: scraped ${prices.length} price(s)`, ultrapc.siteName);
  } catch (err) {
    await logger.error(
      `UltraPC scraping failed: ${err instanceof Error ? err.message : String(err)}`,
      ultrapc.siteName,
    );
  }

  const nextlevel = new NextLevelScraper();
  try {
    const prices = await nextlevel.scrapeAllCategories();
    allPrices.push(...prices);
    await logger.info(`NextLevel: scraped ${prices.length} price(s)`, nextlevel.siteName);
  } catch (err) {
    await logger.error(
      `NextLevel scraping failed: ${err instanceof Error ? err.message : String(err)}`,
      nextlevel.siteName,
    );
  }

  const setupgame = new SetupGameScraper();
  try {
    const prices = await setupgame.scrapeAllCategories();
    allPrices.push(...prices);
    await logger.info(`SetupGame: scraped ${prices.length} price(s)`, setupgame.siteName);
  } catch (err) {
    await logger.error(
      `SetupGame scraping failed: ${err instanceof Error ? err.message : String(err)}`,
      setupgame.siteName,
    );
  }

  const { updated, unmatched, errors } = await aggregate(allPrices);

  // Auto-map any new unmatched listings using the DNA matcher.
  const { mapped: autoMapped } = await autoMap();

  // For listings that still couldn't be matched, auto-create catalog entries
  // from the scraped product name (CPU, GPU, RAM, storage, motherboard only).
  const { created: autoCatalog } = await buildFromUnmatched();

  // If new catalog entries were created, run autoMap again to catch any
  // listings that now match the newly added entries.
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
