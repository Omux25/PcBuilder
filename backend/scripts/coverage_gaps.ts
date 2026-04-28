/**
 * Show exactly which components have no prices and why.
 */
import { sql } from 'bun';

const gaps = await sql`
  SELECT c.id, c.category, c.brand, c.name,
    COUNT(sm.id)::int AS mappings,
    COUNT(p.id)::int  AS prices
  FROM components c
  LEFT JOIN scraper_mappings sm ON sm.component_id = c.id
  LEFT JOIN prices p ON p.component_id = c.id
  WHERE c.is_active = true
  GROUP BY c.id, c.category, c.brand, c.name
  HAVING COUNT(p.id) = 0
  ORDER BY c.category, c.brand, c.name
` as { id: number; category: string; brand: string; name: string; mappings: number; prices: number }[];

const byCategory: Record<string, { mapped: string[]; unmapped: string[] }> = {};
for (const g of gaps) {
  if (!byCategory[g.category]) byCategory[g.category] = { mapped: [], unmapped: [] };
  const label = `${g.brand ?? ''} ${g.name}`.trim();
  if (g.mappings > 0) byCategory[g.category].mapped.push(label);
  else byCategory[g.category].unmapped.push(label);
}

for (const [cat, data] of Object.entries(byCategory).sort()) {
  const total = data.mapped.length + data.unmapped.length;
  console.log(`\n${cat.toUpperCase()} — ${total} without prices`);
  if (data.mapped.length > 0) {
    console.log(`  Has mapping (will get price on next scrape): ${data.mapped.length}`);
    data.mapped.slice(0, 3).forEach(n => console.log(`    - ${n}`));
  }
  if (data.unmapped.length > 0) {
    console.log(`  No mapping (not sold by any retailer): ${data.unmapped.length}`);
    data.unmapped.slice(0, 5).forEach(n => console.log(`    - ${n}`));
    if (data.unmapped.length > 5) console.log(`    ... and ${data.unmapped.length - 5} more`);
  }
}

process.exit(0);
