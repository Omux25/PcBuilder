/**
 * Fix bad storage mappings created before the DNA fix.
 * Finds mappings where the scraped product name doesn't match the catalog entry,
 * deletes them, and resets the unmatched_listings status to 'pending' so
 * the catalog builder can re-process them correctly.
 */
import { sql } from 'bun';
import { scoreDnaMatch } from '../src/utils/componentMatcher.js';

// Get all storage mappings with their scraped names
const mappings = await sql`
  SELECT
    sm.id AS mapping_id,
    sm.component_id,
    sm.retailer_id,
    sm.product_url,
    sm.product_identifier AS scraped_name,
    c.name AS catalog_name,
    c.brand AS catalog_brand
  FROM scraper_mappings sm
  JOIN components c ON c.id = sm.component_id
  WHERE c.category = 'storage'
    AND sm.product_identifier IS NOT NULL
    AND sm.product_identifier != ''
` as {
  mapping_id: number; component_id: number; retailer_id: number;
  product_url: string; scraped_name: string; catalog_name: string; catalog_brand: string;
}[];

console.log(`Checking ${mappings.length} storage mappings...`);

let bad = 0;
let good = 0;

for (const m of mappings) {
  const fullCatalogName = `${m.catalog_brand ?? ''} ${m.catalog_name}`.trim();
  const { score } = scoreDnaMatch(m.scraped_name, fullCatalogName, 'storage');

  if (score < 1.0) {
    bad++;
    if (bad <= 20) {
      console.log(`  BAD (score=${score.toFixed(2)}): "${m.scraped_name}" → "${fullCatalogName}"`);
    }

    // Delete the bad mapping
    await sql`DELETE FROM scraper_mappings WHERE id = ${m.mapping_id}`;

    // Delete the bad price row
    await sql`
      DELETE FROM prices
      WHERE component_id = ${m.component_id}
        AND retailer_id = ${m.retailer_id}
        AND product_url = ${m.product_url}
    `;

    // Reset unmatched_listing to pending so it gets re-processed
    await sql`
      UPDATE unmatched_listings
      SET status = 'pending', linked_component_id = NULL
      WHERE product_url = ${m.product_url}
        AND retailer_id = ${m.retailer_id}
    `;
  } else {
    good++;
  }
}

console.log(`\nGood mappings: ${good}`);
console.log(`Bad mappings removed: ${bad}`);

// Now re-run catalog builder on the reset listings
if (bad > 0) {
  console.log('\nRe-running catalog builder on reset listings...');
  const { buildFromUnmatched } = await import('../scraper/catalogBuilder.js');
  const { autoMap } = await import('../scraper/autoMapper.js');

  const { mapped } = await autoMap();
  console.log(`  autoMap: ${mapped} mapped`);

  const { created, skipped } = await buildFromUnmatched();
  console.log(`  catalogBuilder: ${created} created, ${skipped} skipped`);

  if (created > 0) {
    const { mapped: m2 } = await autoMap();
    console.log(`  autoMap pass 2: ${m2} mapped`);
  }
}

process.exit(0);
