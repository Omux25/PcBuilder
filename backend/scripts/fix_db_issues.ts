/**
 * Fix the issues found by db_health_check.ts
 */
import { sql } from 'bun';

// ── 1. Delete price rows pointing to inactive components ──────────────────────
console.log('=== Fix: prices pointing to inactive components ===');
const deleted = await sql`
  DELETE FROM prices
  WHERE component_id IN (
    SELECT id FROM components WHERE is_active = false
  )
  RETURNING id, component_id
` as { id: number; component_id: number }[];
console.log(`  Deleted ${deleted.length} price row(s)`);

// ── 2. Fix 70 prices with no scraper_mapping ──────────────────────────────────
// These are prices that were inserted before the variant model migration
// (old unique key was component+retailer, new key is component+retailer+url).
// Check what they are first.
console.log('\n=== Prices with no scraper_mapping ===');
const noMapping = await sql`
  SELECT p.id, p.component_id, p.retailer_id, p.product_url,
    c.name, c.category, r.name AS retailer
  FROM prices p
  JOIN components c ON c.id = p.component_id
  JOIN retailers r ON r.id = p.retailer_id
  WHERE NOT EXISTS (
    SELECT 1 FROM scraper_mappings sm
    WHERE sm.component_id = p.component_id
      AND sm.retailer_id = p.retailer_id
      AND sm.product_url = p.product_url
  )
  ORDER BY c.category, r.name
  LIMIT 20
` as { id: number; component_id: number; retailer_id: number; product_url: string; name: string; category: string; retailer: string }[];

console.log(`  Sample (first 20 of 70):`);
for (const p of noMapping) {
  console.log(`  [${p.category}] ${p.retailer}: "${p.name}"`);
  console.log(`    URL: ${p.product_url}`);
}

// Create the missing mappings from the price rows themselves
// (the price row IS the evidence that this product was scraped and matched)
const created = await sql`
  INSERT INTO scraper_mappings (component_id, retailer_id, product_url, product_identifier)
  SELECT DISTINCT p.component_id, p.retailer_id, p.product_url, c.name
  FROM prices p
  JOIN components c ON c.id = p.component_id
  WHERE NOT EXISTS (
    SELECT 1 FROM scraper_mappings sm
    WHERE sm.component_id = p.component_id
      AND sm.retailer_id = p.retailer_id
      AND sm.product_url = p.product_url
  )
  ON CONFLICT (retailer_id, product_url) DO NOTHING
  RETURNING id
` as { id: number }[];
console.log(`\n  Created ${created.length} missing scraper_mapping(s)`);

// ── 3. Fix the "Grizzly Ryzen 7000 Direct Die Frame" CPU misclassification ────
console.log('\n=== Fix: Grizzly Direct Die Frame misclassified as CPU ===');
// This is a CPU cooler accessory, not a CPU. Deactivate it.
const grizzly = await sql`
  UPDATE components SET is_active = false
  WHERE name ILIKE '%direct die frame%' AND category = 'cpu'
  RETURNING id, name
` as { id: number; name: string }[];
if (grizzly.length > 0) {
  console.log(`  Deactivated: ${grizzly.map(g => g.name).join(', ')}`);
  // Also delete its price rows
  await sql`DELETE FROM prices WHERE component_id IN (SELECT id FROM components WHERE name ILIKE '%direct die frame%')`;
  await sql`DELETE FROM scraper_mappings WHERE component_id IN (SELECT id FROM components WHERE name ILIKE '%direct die frame%')`;
} else {
  console.log('  Not found (already fixed or different name)');
}

// ── 4. Summary ────────────────────────────────────────────────────────────────
console.log('\n=== Final check ===');
const remaining = await sql`
  SELECT COUNT(*)::int AS cnt FROM prices p
  JOIN components c ON c.id = p.component_id
  WHERE c.is_active = false
` as { cnt: number }[];
console.log(`Prices pointing to inactive components: ${remaining[0].cnt}`);

const noMappingFinal = await sql`
  SELECT COUNT(*)::int AS cnt FROM prices p
  WHERE NOT EXISTS (
    SELECT 1 FROM scraper_mappings sm
    WHERE sm.component_id = p.component_id
      AND sm.retailer_id = p.retailer_id
      AND sm.product_url = p.product_url
  )
` as { cnt: number }[];
console.log(`Prices with no mapping: ${noMappingFinal[0].cnt}`);

process.exit(0);
