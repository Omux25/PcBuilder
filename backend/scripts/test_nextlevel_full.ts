/**
 * Test the full NextLevel scrape — all pages, all categories.
 */
import { NextLevelScraper } from '../scraper/scrapers/nextlevelScraper.js';

console.log('Starting full NextLevel scrape...');
const start = Date.now();

const scraper = new NextLevelScraper();
const products = await scraper.scrapeAllCategories();

const elapsed = ((Date.now() - start) / 1000).toFixed(1);
console.log(`\nTotal products: ${products.length} in ${elapsed}s`);

// Count per category (inferred from URL)
const byCat: Record<string, number> = {};
for (const p of products) {
  const cat = p.product_url.match(/nextlevelpc\.ma\/(\d+-[^/]+)/)?.[1] ?? 'unknown';
  byCat[cat] = (byCat[cat] ?? 0) + 1;
}
console.log('\nProducts per category:');
for (const [cat, count] of Object.entries(byCat).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${cat}: ${count}`);
}

// Sample 5 products
console.log('\nSample products:');
products.slice(0, 5).forEach(p => {
  console.log(`  [${p.in_stock ? 'IN STOCK' : 'OUT    '}] ${p.price} MAD — ${p.product_name}`);
});

process.exit(0);
