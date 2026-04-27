/**
 * One-shot script to run the UltraPC scraper and populate prices.
 * Run with: bun run scripts/run_ultrapc_scrape.ts
 */

import { UltraPcScraper } from '../scraper/scrapers/ultrapcScraper.js';
import { aggregate } from '../scraper/aggregator.js';
import { logger } from '../scraper/utils/logger.js';

console.log('Starting UltraPC price scrape...');

const scraper = new UltraPcScraper();
const prices = await scraper.scrapeAllCategories();

console.log(`Scraped ${prices.length} products. Running aggregator...`);

const { updated, unmatched, errors } = await aggregate(prices);

console.log(`Done.`);
console.log(`  Updated:   ${updated} prices`);
console.log(`  Unmatched: ${unmatched} products added to unmatched_listings`);
console.log(`  Errors:    ${errors}`);

await logger.info(`Manual UltraPC scrape: ${updated} updated, ${unmatched} unmatched, ${errors} errors`, 'ultrapc.ma');
