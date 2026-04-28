/**
 * Fix obvious duplicate catalog entries from the original seed data.
 * Merges duplicates and deactivates entries that are clearly the same product.
 */
import { sql } from 'bun';

// Known duplicates to merge (keep first, deactivate second)
const merges = [
  // Fractal Design Meshify C appears twice
  { keep: 'Fractal Design Meshify C', deactivate: 'Meshify C', brand: 'Fractal', category: 'case' },
];

let fixed = 0;
for (const m of merges) {
  const keepRow = await sql`
    SELECT id FROM components WHERE name = ${m.keep} AND brand = ${m.brand} AND category = ${m.category} AND is_active = true LIMIT 1
  ` as { id: number }[];
  const deactivateRow = await sql`
    SELECT id FROM components WHERE name = ${m.deactivate} AND brand = ${m.brand} AND category = ${m.category} AND is_active = true LIMIT 1
  ` as { id: number }[];

  if (keepRow.length === 0 || deactivateRow.length === 0) {
    console.log(`  Skipping "${m.keep}" / "${m.deactivate}" — one not found`);
    continue;
  }

  const keepId = keepRow[0].id;
  const removeId = deactivateRow[0].id;

  // Remap any mappings/prices to the kept entry
  await sql`UPDATE scraper_mappings SET component_id = ${keepId} WHERE component_id = ${removeId}`;
  await sql`UPDATE prices SET component_id = ${keepId} WHERE component_id = ${removeId}`;
  await sql`UPDATE price_history SET component_id = ${keepId} WHERE component_id = ${removeId}`;
  await sql`UPDATE components SET is_active = false WHERE id = ${removeId}`;

  console.log(`  Merged [${removeId}] "${m.brand} ${m.deactivate}" → [${keepId}] "${m.brand} ${m.keep}"`);
  fixed++;
}

// Also map the one unmatched RTX 4060 listing we found
const rtx4060 = await sql`
  SELECT id FROM components WHERE name = 'GeForce RTX 4060' AND brand = 'NVIDIA' AND category = 'gpu' LIMIT 1
` as { id: number }[];

if (rtx4060.length > 0) {
  const listing = await sql`
    SELECT ul.id, ul.retailer_id, ul.product_url, ul.scraped_name
    FROM unmatched_listings ul
    WHERE ul.status = 'pending'
      AND ul.scraped_name ILIKE '%rtx 4060%'
      AND ul.scraped_name NOT ILIKE '%ti%'
      AND ul.scraped_name NOT ILIKE '%super%'
    LIMIT 5
  ` as { id: number; retailer_id: number; product_url: string; scraped_name: string }[];

  for (const l of listing) {
    await sql`
      INSERT INTO scraper_mappings (component_id, retailer_id, product_url, product_identifier)
      VALUES (${rtx4060[0].id}, ${l.retailer_id}, ${l.product_url}, ${l.scraped_name})
      ON CONFLICT (retailer_id, product_url) DO NOTHING
    `;
    await sql`
      UPDATE unmatched_listings SET status = 'linked', linked_component_id = ${rtx4060[0].id}
      WHERE id = ${l.id}
    `;
    console.log(`  Mapped RTX 4060: "${l.scraped_name}"`);
    fixed++;
  }
}

console.log(`\nFixed: ${fixed} items`);
process.exit(0);
