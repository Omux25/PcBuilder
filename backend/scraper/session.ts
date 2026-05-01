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
import { UltraPcScraper } from './scrapers/ultrapcScraper.js';
import { NextLevelScraper } from './scrapers/nextlevelScraper.js';
import { SetupGameScraper } from './scrapers/setupgameScraper.js';
import type { ScrapedPrice } from './scrapers/baseScraper.js';

interface ScraperInstance {
  [key: string]: () => Promise<ScrapedPrice[]>;
}

/**
 * Registry of available scrapers mapped to their retailer IDs (from database).
 * This allows targeted scraping of specific retailers.
 *
 * Retailer IDs match the actual rows in the `retailers` table:
 *   UltraPC   → id 10
 *   NextLevel → id 11
 *   SetupGame → id 13
 */
const SCRAPER_REGISTRY = [
  { id: 10, name: 'UltraPC',      instance: () => new UltraPcScraper(),   method: 'scrapeAllCategories' },
  { id: 11, name: 'NextLevel PC', instance: () => new NextLevelScraper(), method: 'scrapeAllCategories' },
  { id: 13, name: 'SetupGame',    instance: () => new SetupGameScraper(), method: 'scrapeAllCategories' },
];

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
    ? SCRAPER_REGISTRY.filter(s => s.id === targetRetailerId)
    : SCRAPER_REGISTRY;

  if (scrapersToRun.length === 0 && targetRetailerId) {
    await logger.warn(`No scraper found for retailer ID ${targetRetailerId}`);
    return;
  }

  await Promise.all(scrapersToRun.map(config => 
    queue.add(async () => {
      const scraper = config.instance() as unknown as ScraperInstance;
      try {
        await logger.info(`Starting ${config.name} scraper...`);
        const prices = await scraper[config.method]();
        allPrices.push(...prices);
        await logger.info(`${config.name}: scraped ${prices.length} price(s)`);
      } catch (err) {
        await logger.error(
          `${config.name} scraping failed: ${err instanceof Error ? err.message : String(err)}`,
          config.name
        );
      }
    })
  ));

  if (allPrices.length === 0) {
    await logger.info('Session complete: 0 updated, 0 unmatched, 0 error(s)');
    return;
  }

  // ── Data Processing Phase ──────────────────────────────────────────────────
  
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
