/**
 * remap_all.ts — Re-runs auto-mapping for all retailers using the smart
 * category-aware DNA matcher.
 *
 * Strategy (based on Gemini recommendations):
 * - Extract structured "DNA" tokens per category (chipset, model number, capacity, etc.)
 * - Require ALL DNA tokens to match (score = 1.0) to avoid false positives
 * - "RTX 4070" will never match "RTX 4080" because their chipset tokens differ
 * - Falls back to 0.8 partial match only for categories with simple DNA (case, cooling)
 *
 * Run with:
 *   bun run scripts/remap_all.ts
 */

import { sql } from 'bun';
import { UltraPcScraper } from '../scraper/scrapers/ultrapcScraper.js';
import { NextLevelScraper } from '../scraper/scrapers/nextlevelScraper.js';
import { SetupGameScraper } from '../scraper/scrapers/setupgameScraper.js';
import { findBestMatch, type CatalogComponent } from '../src/utils/componentMatcher.js';

// Categories where partial DNA match is acceptable (less critical model numbers)
const PARTIAL_MATCH_CATEGORIES = new Set(['case', 'cooling']);
const PARTIAL_THRESHOLD = 0.8;

async function remapRetailer(
  retailerId: number,
  name: string,
  products: { product_url: string; product_name?: string }[],
  components: CatalogComponent[],
) {
  const existing = await sql`
    SELECT product_url FROM scraper_mappings WHERE retailer_id = ${retailerId}
  ` as { product_url: string }[];
  const alreadyMapped = new Set(existing.map((r) => r.product_url));

  let mapped = 0, skipped = 0, unmatched = 0;
  const examples: string[] = [];

  for (const product of products) {
    if (alreadyMapped.has(product.product_url)) { skipped++; continue; }
    const productName = product.product_name ?? '';
    if (!productName) { unmatched++; continue; }

    // Try perfect DNA match first (score = 1.0)
    let match = findBestMatch(productName, components, 1.0);

    // For case/cooling, allow partial match
    if (!match) {
      const partialMatch = findBestMatch(productName, components, PARTIAL_THRESHOLD);
      if (partialMatch) {
        const cat = components.find((c) => c.id === partialMatch.componentId)?.category ?? '';
        if (PARTIAL_MATCH_CATEGORIES.has(cat)) match = partialMatch;
      }
    }

    if (match) {
      try {
        await sql`
          INSERT INTO scraper_mappings (component_id, retailer_id, product_url, product_identifier)
          VALUES (${match.componentId}, ${retailerId}, ${product.product_url}, ${productName})
          ON CONFLICT (retailer_id, product_url) DO NOTHING
        `;
        mapped++;
        if (examples.length < 5) {
          const comp = components.find((c) => c.id === match!.componentId);
          examples.push(`  MAPPED (${(match.score * 100).toFixed(0)}%): "${productName}" → "${comp?.brand ?? ''} ${comp?.name ?? ''}"`);
        }
      } catch { /* skip duplicate */ }
    } else {
      unmatched++;
    }
  }

  const total = await sql`
    SELECT COUNT(id) AS cnt FROM scraper_mappings WHERE retailer_id = ${retailerId}
  ` as { cnt: string }[];

  console.log(`\n${name}: +${mapped} new (${skipped} skipped, ${unmatched} unmatched) — total: ${total[0].cnt}`);
  for (const ex of examples) console.log(ex);
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log('Loading catalog components...');
const components = await sql`
  SELECT id, name, brand, category FROM components WHERE is_active = true
` as CatalogComponent[];
console.log(`Loaded ${components.length} components.\n`);

console.log('Scraping UltraPC...');
const ultrapcProducts = await new UltraPcScraper().scrapeAllCategories();
console.log(`  ${ultrapcProducts.length} products scraped.`);
await remapRetailer(10, 'UltraPC', ultrapcProducts, components);

console.log('\nScraping NextLevel PC...');
const nextlevelProducts = await new NextLevelScraper().scrapeAllCategories();
console.log(`  ${nextlevelProducts.length} products scraped.`);
await remapRetailer(11, 'NextLevel PC', nextlevelProducts, components);

console.log('\nScraping SetupGame...');
const setupgameProducts = await new SetupGameScraper().scrapeAllCategories();
console.log(`  ${setupgameProducts.length} products scraped.`);
await remapRetailer(13, 'SetupGame', setupgameProducts, components);

// Run price aggregation for newly mapped products
console.log('\n\nRunning price aggregation for new mappings...');
const { aggregate } = await import('../scraper/aggregator.js');
const allProducts = [...ultrapcProducts, ...nextlevelProducts, ...setupgameProducts];
const { updated, unmatched, errors } = await aggregate(allProducts);
console.log(`Aggregation: ${updated} prices updated, ${unmatched} unmatched, ${errors} errors`);

// Coverage report
const coverage = await sql`
  SELECT
    c.category,
    COUNT(DISTINCT c.id) AS total,
    COUNT(DISTINCT p.component_id) AS with_prices
  FROM components c
  LEFT JOIN prices p ON p.component_id = c.id
  WHERE c.is_active = true
  GROUP BY c.category
  ORDER BY c.category
` as { category: string; total: string; with_prices: string }[];

console.log('\n=== Coverage After Remapping ===');
for (const row of coverage) {
  const pct = Math.round(parseInt(row.with_prices) / parseInt(row.total) * 100);
  const bar = '█'.repeat(Math.round(pct / 5)) + '░'.repeat(20 - Math.round(pct / 5));
  console.log(`  ${row.category.padEnd(12)} ${bar} ${row.with_prices}/${row.total} (${pct}%)`);
}
