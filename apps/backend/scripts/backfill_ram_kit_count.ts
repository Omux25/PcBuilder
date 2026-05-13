/**
 * backfill_ram_kit_count.ts
 *
 * Re-parses raw scraped names (product_identifier in scraper_mappings) to
 * extract kit_count for RAM components that currently have kit_count = 1
 * but whose raw name contains kit notation like "(2x8GB)", "2x16GB", "2 x 8Go".
 *
 * Run once after migration 034:
 *   bun run scripts/backfill_ram_kit_count.ts
 */

import { getSql } from '../src/db/index.js';
import { extractRamSpecs } from '@shared/component-utils';

const sql = getSql();

// Fetch all RAM components with kit_count = 1 that have scraper_mappings
const rows = (await sql`
  SELECT DISTINCT ON (sm.component_id)
    sm.component_id,
    sm.product_identifier,
    c.name
  FROM scraper_mappings sm
  JOIN components c ON c.id = sm.component_id
  WHERE c.category = 'ram'
    AND c.kit_count = 1
    AND sm.product_identifier IS NOT NULL
    AND sm.product_identifier != ''
  ORDER BY sm.component_id, sm.id ASC
`) as { component_id: number; product_identifier: string; name: string }[];

console.log(`Checking ${rows.length} RAM components...`);

let updated = 0;
let skipped = 0;

for (const row of rows) {
    const { kit_count } = extractRamSpecs(row.product_identifier);
    if (kit_count > 1) {
        await sql`
      UPDATE components
      SET kit_count = ${kit_count}, updated_at = NOW()
      WHERE id = ${row.component_id}
    `;
        console.log(`  ✓ [${row.component_id}] "${row.name}" → kit_count=${kit_count}  (from: "${row.product_identifier.slice(0, 80)}")`);
        updated++;
    } else {
        skipped++;
    }
}

console.log(`\nDone. Updated: ${updated}, Skipped (kit_count=1): ${skipped}`);
process.exit(0);
