/**
 * Analyze unmatched listings to understand what's missing from the catalog
 * vs what's genuinely unmatchable (accessories, peripherals, bundles).
 */
import { sql } from 'bun';
import { findBestMatch, type CatalogComponent } from '../src/utils/componentMatcher.js';

// Load catalog
const components = await sql`
  SELECT id, name, brand, category FROM components WHERE is_active = true
` as CatalogComponent[];

// Get all pending unmatched listings
const pending = await sql`
  SELECT ul.id, ul.retailer_id, ul.product_url, ul.scraped_name,
    r.name AS retailer_name
  FROM unmatched_listings ul
  JOIN retailers r ON r.id = ul.retailer_id
  WHERE ul.status = 'pending'
    AND ul.scraped_name IS NOT NULL
    AND ul.scraped_name != ''
  ORDER BY ul.retailer_id, ul.scraped_name
` as { id: number; retailer_id: number; product_url: string; scraped_name: string; retailer_name: string }[];

console.log(`\nAnalyzing ${pending.length} pending unmatched listings...\n`);

let wouldMatch = 0;
let noMatch = 0;
const noMatchSamples: string[] = [];
const wouldMatchSamples: string[] = [];

for (const listing of pending) {
  const match = findBestMatch(listing.scraped_name, components, 1.0);
  if (match) {
    wouldMatch++;
    if (wouldMatchSamples.length < 10) {
      const comp = components.find(c => c.id === match.componentId);
      wouldMatchSamples.push(`  "${listing.scraped_name}" → ${comp?.brand} ${comp?.name}`);
    }
  } else {
    noMatch++;
    if (noMatchSamples.length < 30) {
      noMatchSamples.push(`  [${listing.retailer_name}] "${listing.scraped_name}"`);
    }
  }
}

console.log(`Would auto-match now: ${wouldMatch} (${Math.round(wouldMatch / pending.length * 100)}%)`);
console.log(`No match (accessories/unknown): ${noMatch} (${Math.round(noMatch / pending.length * 100)}%)`);

console.log('\n=== Sample: would match ===');
wouldMatchSamples.forEach(s => console.log(s));

console.log('\n=== Sample: no match (first 30) ===');
noMatchSamples.forEach(s => console.log(s));

process.exit(0);
