/**
 * Auto-mapping script for SetupGame (retailer_id = 13).
 * Uses the smart DNA matcher from componentMatcher.ts.
 *
 * Run with:
 *   bun run scripts/auto_map_setupgame.ts
 */

import { sql } from 'bun';
import { SetupGameScraper } from '../scraper/scrapers/setupgameScraper.js';
import { findBestMatch, type CatalogComponent } from '../src/utils/componentMatcher.js';

const PARTIAL_MATCH_CATEGORIES = new Set(['case', 'cooling']);
const PARTIAL_THRESHOLD = 0.8;

async function main() {
  console.log('Scraping SetupGame...');
  const scraper = new SetupGameScraper();
  const products = await scraper.scrapeAllCategories();
  console.log(`Scraped ${products.length} products.`);

  const components = await sql`
    SELECT id, name, brand, category FROM components WHERE is_active = true
  ` as CatalogComponent[];

  const existing = await sql`
    SELECT product_url FROM scraper_mappings WHERE retailer_id = 13
  ` as { product_url: string }[];
  const alreadyMapped = new Set(existing.map((r) => r.product_url));

  let mapped = 0, skipped = 0, unmatched = 0;

  for (const product of products) {
    if (alreadyMapped.has(product.product_url)) { skipped++; continue; }
    const productName = product.product_name ?? '';
    if (!productName) { unmatched++; continue; }

    let match = findBestMatch(productName, components, 1.0);

    if (!match) {
      const partial = findBestMatch(productName, components, PARTIAL_THRESHOLD);
      if (partial) {
        const cat = components.find((c) => c.id === partial.componentId)?.category ?? '';
        if (PARTIAL_MATCH_CATEGORIES.has(cat)) match = partial;
      }
    }

    if (match) {
      try {
        await sql`
          INSERT INTO scraper_mappings (component_id, retailer_id, product_url, product_identifier)
          VALUES (${match.componentId}, 13, ${product.product_url}, ${productName})
          ON CONFLICT (retailer_id, product_url) DO NOTHING
        `;
        mapped++;
        if (mapped <= 10) {
          const comp = components.find((c) => c.id === match!.componentId);
          console.log(`  MAPPED: "${productName}" → "${comp?.brand ?? ''} ${comp?.name ?? ''}"`);
        }
      } catch { /* skip */ }
    } else {
      unmatched++;
    }
  }

  console.log(`\nDone. Mapped: ${mapped}, Skipped: ${skipped}, Unmatched: ${unmatched}`);
  const total = await sql`
    SELECT COUNT(id) AS cnt FROM scraper_mappings WHERE retailer_id = 13
  ` as { cnt: string }[];
  console.log(`Total SetupGame mappings: ${total[0].cnt}`);
}

main().catch(console.error);
