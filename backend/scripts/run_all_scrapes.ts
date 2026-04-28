/**
 * Runs price scrapes for all 3 retailers and populates the prices table.
 */
import { sql } from 'bun';
import { UltraPcScraper } from '../scraper/scrapers/ultrapcScraper.js';
import { NextLevelScraper } from '../scraper/scrapers/nextlevelScraper.js';
import { SetupGameScraper } from '../scraper/scrapers/setupgameScraper.js';
import { aggregate } from '../scraper/aggregator.js';
import { logger } from '../scraper/utils/logger.js';

async function scrapeRetailer(name: string, fn: () => Promise<any[]>) {
  console.log(`\nScraping ${name}...`);
  try {
    const prices = await fn();
    console.log(`  Scraped ${prices.length} products. Running aggregator...`);
    const { updated, unmatched, errors } = await aggregate(prices);
    console.log(`  Updated: ${updated} prices, Unmatched: ${unmatched}, Errors: ${errors}`);
    await logger.info(`${name} scrape: ${updated} updated, ${unmatched} unmatched, ${errors} errors`, name.toLowerCase().replace(' ', ''));
    return { updated, unmatched, errors };
  } catch (err) {
    console.error(`  FAILED: ${(err as Error).message}`);
    return { updated: 0, unmatched: 0, errors: 1 };
  }
}

console.log('Starting full price scrape for all retailers...');

await scrapeRetailer('UltraPC', () => new UltraPcScraper().scrapeAllCategories());
await scrapeRetailer('NextLevel PC', () => new NextLevelScraper().scrapeAllCategories());
await scrapeRetailer('SetupGame', () => new SetupGameScraper().scrapeAllCategories());

// Final DB summary
const summary = await sql`
  SELECT r.name, COUNT(p.id) AS price_count
  FROM retailers r
  LEFT JOIN prices p ON p.retailer_id = r.id
  WHERE r.id IN (10, 11, 13)
  GROUP BY r.id, r.name
  ORDER BY r.id
` as { name: string; price_count: string }[];

console.log('\n=== Final Price Counts ===');
for (const row of summary) {
  console.log(`  ${row.name}: ${row.price_count} prices`);
}
