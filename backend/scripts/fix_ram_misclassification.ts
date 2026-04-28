/**
 * Fix RAM entries that are actually motherboards (misclassified by catalogBuilder).
 * Also fix any RAM→motherboard cross-mappings created by the old matcher.
 */
import { sql } from 'bun';

// 1. Find RAM entries that look like motherboards (contain chipset patterns)
const badRam = await sql`
  SELECT id, name, brand FROM components
  WHERE category = 'ram' AND is_active = true
    AND (name ~ '[ABXHZ][0-9]{3,4}' OR name ILIKE '%prime%' OR name ILIKE '%tuf gaming%'
         OR name ILIKE '%rog%' OR name ILIKE '%pro b%' OR name ILIKE '%mag b%'
         OR name ILIKE '%mpg b%' OR name ILIKE '%gaming plus%')
  ORDER BY name
` as { id: number; name: string; brand: string }[];

console.log(`Found ${badRam.length} RAM entries that look like motherboards:`);
for (const r of badRam) {
  console.log(`  [${r.id}] ${r.brand} ${r.name}`);
}

// Deactivate them and delete their mappings/prices
let fixed = 0;
for (const r of badRam) {
  await sql`UPDATE components SET is_active = false WHERE id = ${r.id}`;
  await sql`DELETE FROM scraper_mappings WHERE component_id = ${r.id}`;
  await sql`DELETE FROM prices WHERE component_id = ${r.id}`;
  // Reset unmatched listings
  await sql`
    UPDATE unmatched_listings SET status = 'pending', linked_component_id = NULL
    WHERE linked_component_id = ${r.id}
  `;
  fixed++;
}
console.log(`\nDeactivated ${fixed} misclassified RAM entries`);

// 2. Find RAM→motherboard cross-mappings (RAM product mapped to motherboard URL)
const crossMappings = await sql`
  SELECT sm.id, sm.product_identifier, sm.product_url, c.name, c.category, r.name AS retailer
  FROM scraper_mappings sm
  JOIN components c ON c.id = sm.component_id
  JOIN retailers r ON r.id = sm.retailer_id
  WHERE c.category = 'ram'
    AND (sm.product_url ILIKE '%carte-mere%' OR sm.product_url ILIKE '%b650%'
         OR sm.product_url ILIKE '%b760%' OR sm.product_url ILIKE '%b850%'
         OR sm.product_url ILIKE '%x870%' OR sm.product_url ILIKE '%z790%'
         OR sm.product_url ILIKE '%h610%' OR sm.product_url ILIKE '%a520%')
  LIMIT 20
` as { id: number; product_identifier: string; product_url: string; name: string; category: string; retailer: string }[];

console.log(`\nFound ${crossMappings.length} RAM→motherboard URL cross-mappings:`);
for (const m of crossMappings) {
  console.log(`  [${m.retailer}] "${m.product_identifier}" → ${m.name} (${m.category})`);
}

let crossFixed = 0;
for (const m of crossMappings) {
  await sql`DELETE FROM scraper_mappings WHERE id = ${m.id}`;
  await sql`
    DELETE FROM prices WHERE product_url = ${m.product_url}
      AND component_id = (SELECT component_id FROM scraper_mappings WHERE id = ${m.id} LIMIT 1)
  `;
  await sql`
    UPDATE unmatched_listings SET status = 'pending', linked_component_id = NULL
    WHERE product_url = ${m.product_url}
  `;
  crossFixed++;
}
console.log(`Removed ${crossFixed} cross-mappings`);

// 3. Final RAM stats
const ramStats = await sql`
  SELECT COUNT(*)::int AS total,
    COUNT(CASE WHEN is_active THEN 1 END)::int AS active
  FROM components WHERE category = 'ram'
` as { total: number; active: number }[];
console.log(`\nRAM catalog: ${ramStats[0].active} active / ${ramStats[0].total} total`);

process.exit(0);
