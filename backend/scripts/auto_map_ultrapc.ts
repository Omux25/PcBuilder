/**
 * Auto-mapping script — matches UltraPC products to catalog components.
 *
 * Uses the smart DNA matcher from componentMatcher.ts:
 * - GPU: requires exact chipset match (rtx4090, rx7900xtx)
 * - CPU: requires family + model number (ryzen5 + 7600x)
 * - RAM: requires capacity + type + speed (32gb + ddr5 + 6000)
 * - etc.
 *
 * Run with:
 *   bun run scripts/auto_map_ultrapc.ts
 */

import { sql } from 'bun';
import { UltraPcScraper } from '../scraper/scrapers/ultrapcScraper.js';
import { findBestMatch, type CatalogComponent } from '../src/utils/componentMatcher.js';

const PARTIAL_MATCH_CATEGORIES = new Set(['case', 'cooling']);
const PARTIAL_THRESHOLD = 0.8;

async function main() {
  console.log('Fetching catalog components...');
  const components = await sql`
    SELECT id, name, brand, category FROM components WHERE is_active = true
  ` as CatalogComponent[];
  console.log(`Loaded ${components.length} catalog components.`);

  console.log('Scraping UltraPC products...');
  const scraper = new UltraPcScraper();
  const products = await scraper.scrapeAllCategories();
  console.log(`Scraped ${products.length} UltraPC products.`);

  const existingMappings = await sql`
    SELECT product_url FROM scraper_mappings WHERE retailer_id = 10
  ` as { product_url: string }[];
  const alreadyMapped = new Set(existingMappings.map((m) => m.product_url));
  console.log(`${alreadyMapped.size} products already mapped. Skipping those.`);

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
          VALUES (${match.componentId}, 10, ${product.product_url}, ${productName})
          ON CONFLICT (retailer_id, product_url) DO NOTHING
        `;
        mapped++;
        if (mapped <= 20) {
          const comp = components.find((c) => c.id === match!.componentId);
          console.log(`  MAPPED (${(match.score * 100).toFixed(0)}%): "${productName}"`);
          console.log(`      -> "${comp?.brand ?? ''} ${comp?.name ?? ''}" [${comp?.category}]`);
        }
      } catch (err) {
        console.error(`  ERROR mapping ${product.product_url}: ${(err as Error).message}`);
      }
    } else {
      unmatched++;
      if (unmatched <= 10) {
        console.log(`  UNMATCHED: "${productName}"`);
      }
    }
  }

  console.log(`\nDone. Mapped: ${mapped}, Skipped: ${skipped}, Unmatched: ${unmatched}`);
  const total = await sql`
    SELECT COUNT(id) AS cnt FROM scraper_mappings WHERE retailer_id = 10
  ` as { cnt: string }[];
  console.log(`Total mappings for UltraPC: ${total[0].cnt}`);
}

main().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
