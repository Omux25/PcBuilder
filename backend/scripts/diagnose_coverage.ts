/**
 * Diagnose why storage coverage is only 8%.
 * Find components with no prices and check if they have mappings.
 */
import { sql } from 'bun';
import { extractDna } from '../src/utils/componentMatcher.js';

// Components with no prices
const noPrices = await sql`
  SELECT c.id, c.category, c.brand, c.name,
    COUNT(sm.id) AS mapping_count,
    COUNT(p.id) AS price_count
  FROM components c
  LEFT JOIN scraper_mappings sm ON sm.component_id = c.id
  LEFT JOIN prices p ON p.component_id = c.id
  WHERE c.is_active = true
  GROUP BY c.id, c.category, c.brand, c.name
  HAVING COUNT(p.id) = 0
  ORDER BY c.category, c.id
` as { id: number; category: string; brand: string; name: string; mapping_count: number; price_count: number }[];

// Group by category
const byCat: Record<string, { withMapping: number; noMapping: number; samples: string[] }> = {};
for (const c of noPrices) {
  if (!byCat[c.category]) byCat[c.category] = { withMapping: 0, noMapping: 0, samples: [] };
  if (c.mapping_count > 0) {
    byCat[c.category].withMapping++;
  } else {
    byCat[c.category].noMapping++;
    if (byCat[c.category].samples.length < 3) {
      byCat[c.category].samples.push(`${c.brand} ${c.name}`);
    }
  }
}

console.log('\n=== Components with no prices ===');
for (const [cat, data] of Object.entries(byCat).sort()) {
  console.log(`\n${cat}: ${data.withMapping + data.noMapping} total without prices`);
  console.log(`  Has mapping but no price: ${data.withMapping} (scraper hasn't run yet)`);
  console.log(`  No mapping at all:        ${data.noMapping} (not found by any scraper)`);
  if (data.samples.length > 0) {
    console.log(`  Sample no-mapping entries:`);
    data.samples.forEach(s => console.log(`    - ${s}`));
  }
}

// Check if the storage entries have mappings
const storageStats = await sql`
  SELECT
    COUNT(*) FILTER (WHERE p.id IS NOT NULL) AS with_prices,
    COUNT(*) FILTER (WHERE p.id IS NULL AND sm.id IS NOT NULL) AS mapped_no_price,
    COUNT(*) FILTER (WHERE p.id IS NULL AND sm.id IS NULL) AS no_mapping
  FROM components c
  LEFT JOIN scraper_mappings sm ON sm.component_id = c.id
  LEFT JOIN prices p ON p.component_id = c.id
  WHERE c.category = 'storage' AND c.is_active = true
` as { with_prices: number; mapped_no_price: number; no_mapping: number }[];

console.log('\n=== Storage breakdown ===');
console.log(`With prices:           ${storageStats[0].with_prices}`);
console.log(`Mapped but no price:   ${storageStats[0].mapped_no_price} (will get prices on next scrape)`);
console.log(`No mapping at all:     ${storageStats[0].no_mapping} (not in any retailer's catalog)`);

process.exit(0);
