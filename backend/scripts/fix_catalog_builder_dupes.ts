/**
 * Fix duplicates created by running catalogBuilder twice,
 * and deactivate cooling entries that are actually cases.
 */
import { sql } from 'bun';

// 1. Fix duplicates — keep lowest id, remap and deactivate higher ids
const dupes = await sql`
  SELECT brand, name, COUNT(*)::int AS cnt, array_agg(id ORDER BY id) AS ids
  FROM components
  WHERE is_active = true
  GROUP BY brand, name
  HAVING COUNT(*) > 1
  ORDER BY cnt DESC
` as { brand: string; name: string; cnt: number; ids: number[] }[];

console.log(`Found ${dupes.length} duplicate groups`);
let deduped = 0;
for (const d of dupes) {
  const keepId = d.ids[0];
  for (const removeId of d.ids.slice(1)) {
    await sql`UPDATE scraper_mappings SET component_id = ${keepId} WHERE component_id = ${removeId}`;
    await sql`UPDATE prices SET component_id = ${keepId} WHERE component_id = ${removeId}`;
    await sql`UPDATE price_history SET component_id = ${keepId} WHERE component_id = ${removeId}`;
    await sql`UPDATE unmatched_listings SET linked_component_id = ${keepId} WHERE linked_component_id = ${removeId}`;
    await sql`UPDATE components SET is_active = false WHERE id = ${removeId}`;
    deduped++;
  }
}
console.log(`Deactivated ${deduped} duplicate entries`);

// 2. Deactivate cooling entries that are actually cases
// (Corsair AIR series, Montech Air, Fractal Pop Air — these are cases)
const badCooling = await sql`
  SELECT id, name, brand FROM components
  WHERE category = 'cooling' AND is_active = true
    AND (
      name ILIKE '%corsair air%' OR name ILIKE '%montech air%'
      OR name ILIKE '%fractal pop air%' OR name ILIKE '%fractal define air%'
      OR (name ILIKE '%air%' AND brand IN ('Corsair', 'Montech', 'Fractal'))
    )
  ORDER BY name
` as { id: number; name: string; brand: string }[];

console.log(`\nFound ${badCooling.length} cooling entries that are actually cases:`);
for (const c of badCooling) {
  console.log(`  [${c.id}] ${c.brand} ${c.name}`);
}

let fixedCooling = 0;
for (const c of badCooling) {
  // Check if it's really a case (has "air" but no AIO/liquid/cooler keywords)
  const n = c.name.toLowerCase();
  const isCase = !n.match(/\b(aio|liquid|cooler|ventirad|freezer|240mm|280mm|360mm)\b/);
  if (isCase) {
    // Reclassify as case with default max_gpu_length_mm
    await sql`
      UPDATE components SET category = 'case', max_gpu_length_mm = 380
      WHERE id = ${c.id}
    `;
    fixedCooling++;
    console.log(`  → Reclassified as case: ${c.brand} ${c.name}`);
  }
}
console.log(`Reclassified ${fixedCooling} entries from cooling → case`);

// 3. Final stats
const stats = await sql`
  SELECT category, COUNT(*)::int AS total,
    COUNT(CASE WHEN is_active THEN 1 END)::int AS active
  FROM components GROUP BY category ORDER BY category
` as { category: string; total: number; active: number }[];

console.log('\n=== Catalog breakdown ===');
for (const s of stats) {
  console.log(`  ${s.category.padEnd(12)}: ${s.active} active / ${s.total} total`);
}

process.exit(0);
