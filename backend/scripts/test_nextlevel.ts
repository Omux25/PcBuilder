import { NextLevelScraper } from '../scraper/scrapers/nextlevelScraper.js';

const scraper = new NextLevelScraper();
console.log('Testing NextLevel PC scraper (all categories)...');

const prices = await scraper.scrapeAllCategories();

console.log(`Total scraped: ${prices.length}`);
console.log('Sample (first 5):');
for (const p of prices.slice(0, 5)) {
  console.log(`  ${p.product_name} | ${p.price} MAD | ${p.in_stock ? 'in stock' : 'out of stock'}`);
  console.log(`  URL: ${p.product_url}`);
}
