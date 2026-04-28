/**
 * Fix PSU components mapped to motherboard URLs (and vice versa).
 * These are DNA matcher false positives where PSU wattage numbers
 * match chipset numbers in motherboard names.
 */
import { sql } from 'bun';

// Find all prices where the component category doesn't match the URL pattern
// PSU mapped to motherboard URLs
const psuOnMbUrls = await sql`
  SELECT p.id AS price_id, sm.id AS mapping_id,
    c.id AS component_id, c.name, c.category,
    p.product_url, r.name AS retailer
  FROM prices p
  JOIN components c ON c.id = p.component_id
  JOIN retailers r ON r.id = p.retailer_id
  LEFT JOIN scraper_mappings sm ON sm.component_id = p.component_id
    AND sm.retailer_id = p.retailer_id
    AND sm.product_url = p.product_url
  WHERE c.category = 'psu'
    AND (
      p.product_url ILIKE '%carte-mere%'
      OR p.product_url ILIKE '%motherboard%'
      OR p.product_url ILIKE '%b650%' OR p.product_url ILIKE '%b850%'
      OR p.product_url ILIKE '%b760%' OR p.product_url ILIKE '%z790%'
      OR p.product_url ILIKE '%x870%' OR p.product_url ILIKE '%b550%'
      OR p.product_url ILIKE '%a520%' OR p.product_url ILIKE '%h610%'
      OR p.product_url ILIKE '%h510%' OR p.product_url ILIKE '%b460%'
    )
` as { price_id: number; mapping_id: number; component_id: number; name: string; category: string; product_url: string; retailer: string }[];

console.log(`Found ${psuOnMbUrls.length} PSU prices on motherboard URLs`);
for (const p of psuOnMbUrls.slice(0, 10)) {
  console.log(`  [${p.retailer}] "${p.name}" → ${p.product_url.split('/').pop()}`);
}

// Delete bad price rows and mappings
let deletedPrices = 0;
let deletedMappings = 0;
for (const p of psuOnMbUrls) {
  await sql`DELETE FROM prices WHERE id = ${p.price_id}`;
  deletedPrices++;
  if (p.mapping_id) {
    await sql`DELETE FROM scraper_mappings WHERE id = ${p.mapping_id}`;
    deletedMappings++;
  }
  // Reset unmatched listing to pending
  await sql`
    UPDATE unmatched_listings SET status = 'pending', linked_component_id = NULL
    WHERE product_url = ${p.product_url}
      AND retailer_id = (SELECT id FROM retailers WHERE name = ${p.retailer})
  `;
}
console.log(`Deleted ${deletedPrices} bad price rows, ${deletedMappings} bad mappings`);

// Also check for storage on CPU/GPU URLs and other obvious mismatches
const storageMismatches = await sql`
  SELECT COUNT(*)::int AS cnt FROM prices p
  JOIN components c ON c.id = p.component_id
  WHERE c.category = 'storage'
    AND (p.product_url ILIKE '%processeur%' OR p.product_url ILIKE '%carte-graphique%')
` as { cnt: number }[];
console.log(`\nStorage on CPU/GPU URLs: ${storageMismatches[0].cnt}`);

const cpuMismatches = await sql`
  SELECT COUNT(*)::int AS cnt FROM prices p
  JOIN components c ON c.id = p.component_id
  WHERE c.category = 'cpu'
    AND (p.product_url ILIKE '%alimentation%' OR p.product_url ILIKE '%boitier%'
         OR p.product_url ILIKE '%memoire%' OR p.product_url ILIKE '%disque%')
` as { cnt: number }[];
console.log(`CPU on PSU/case/RAM/storage URLs: ${cpuMismatches[0].cnt}`);

// Final remaining no-mapping count
const remaining = await sql`
  SELECT COUNT(*)::int AS cnt FROM prices p
  WHERE NOT EXISTS (
    SELECT 1 FROM scraper_mappings sm
    WHERE sm.component_id = p.component_id
      AND sm.retailer_id = p.retailer_id
      AND sm.product_url = p.product_url
  )
` as { cnt: number }[];
console.log(`\nRemaining prices with no mapping: ${remaining[0].cnt}`);

process.exit(0);
