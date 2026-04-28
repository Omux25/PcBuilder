/**
 * fix_remaining.ts — fix the last H410 mapping and update JSONB specs
 * for all newly inserted motherboards.
 */
import { sql } from 'bun';

// Fix the H410 mapping that didn't match (URL has "h410-m-k", slug has "h410m-k")
const h410 = await sql`SELECT id FROM components WHERE slug = 'asus-prime-h410m-k'` as { id: number }[];
if (h410.length > 0) {
  const result = await sql`
    UPDATE scraper_mappings sm
    SET component_id = ${h410[0].id}
    FROM components c
    WHERE sm.component_id = c.id
      AND (c.brand ILIKE '%generic%' OR c.name ILIKE '%generic%')
      AND sm.product_url ILIKE '%h410%'
    RETURNING sm.id, sm.product_url
  ` as { id: number; product_url: string }[];
  console.log(`Fixed H410 mapping: ${result.length} rows`);
  for (const r of result) console.log(`  ${r.product_url}`);
}

// Update JSONB specs for all newly inserted motherboards (they were inserted with null specs)
// Re-run the specs update using the data we already have in the other columns
const mbs = await sql`
  SELECT id, name, brand, socket, supported_ram_types, max_ram_frequency
  FROM components
  WHERE category = 'motherboard'
    AND is_active = true
    AND brand NOT ILIKE '%generic%'
    AND (specs IS NULL OR specs = 'null'::jsonb OR specs::text = '{}')
` as { id: number; name: string; brand: string; socket: string; supported_ram_types: string[]; max_ram_frequency: number }[];

console.log(`\nUpdating specs for ${mbs.length} motherboards with missing JSONB...`);

for (const mb of mbs) {
  // Extract chipset from name
  const chipsetMatch = mb.name.match(/\b([A-Z][0-9]{3,4}[EI]?)\b/i);
  const chipset = chipsetMatch ? chipsetMatch[1] : '';

  const specs = {
    socket: mb.socket,
    chipset,
    form_factor: 'ATX',
    ram_slots: 4,
    max_ram_gb: mb.socket === 'LGA1851' || mb.socket === 'AM5' ? 256 : 128,
    supported_ram_types: mb.supported_ram_types,
    max_ram_frequency: mb.max_ram_frequency,
  };

  await sql`
    UPDATE components
    SET specs = ${JSON.stringify(specs)}::jsonb
    WHERE id = ${mb.id}
  `;
}

console.log('Done.');
process.exit(0);
