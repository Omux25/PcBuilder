/**
 * Test the fixed NextLevel scraper — verify i5-14400F gets the right price.
 */
import { NextLevelScraper } from '../scraper/scrapers/nextlevelScraper.js';

const scraper = new NextLevelScraper();

// Scrape just the CPU category
const prices = await (scraper as any).scrapeCategory('https://nextlevelpc.ma/165-processeur');

// Find the i5-14400F
const target = prices.filter((p: any) =>
  p.product_name?.toLowerCase().includes('14400f') &&
  p.product_name?.toLowerCase().includes('tray')
);

console.log(`Total CPU prices scraped: ${prices.length}`);
console.log('\n=== i5-14400F TRAY entries ===');
for (const p of target) {
  console.log(`  ${p.price} MAD | in_stock=${p.in_stock}`);
  console.log(`  Name: ${p.product_name}`);
  console.log(`  URL: ${p.product_url}`);
}

// Also check for any suspiciously low prices (< 500 MAD for CPUs)
const suspicious = prices.filter((p: any) => p.price < 500);
if (suspicious.length > 0) {
  console.log('\n=== Suspicious prices (< 500 MAD) ===');
  for (const p of suspicious) {
    console.log(`  ${p.price} MAD | ${p.product_name}`);
  }
} else {
  console.log('\n✓ No suspiciously low prices found');
}

process.exit(0);
