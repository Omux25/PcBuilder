/**
 * check_generics.ts — find all generic/placeholder components and their mappings
 */
import { sql } from 'bun';

// 1. All generic components
const generics = await sql`
  SELECT id, category, brand, name, slug, is_active
  FROM components
  WHERE brand ILIKE '%generic%' OR name ILIKE '%generic%'
  ORDER BY category, name
` as { id: number; category: string; brand: string; name: string; slug: string; is_active: boolean }[];

console.log(`\n=== Generic components (${generics.length} total) ===`);
for (const g of generics) {
  console.log(`  [${g.id}] ${g.category} | ${g.brand} ${g.name} | active=${g.is_active}`);
}

// 2. How many scraper_mappings point to generic components
const mappings = await sql`
  SELECT c.id, c.category, c.brand, c.name, COUNT(sm.id) as mapping_count
  FROM components c
  JOIN scraper_mappings sm ON sm.component_id = c.id
  WHERE c.brand ILIKE '%generic%' OR c.name ILIKE '%generic%'
  GROUP BY c.id, c.category, c.brand, c.name
  ORDER BY mapping_count DESC
` as { id: number; category: string; brand: string; name: string; mapping_count: number }[];

console.log(`\n=== Mappings pointing to generic components ===`);
for (const m of mappings) {
  console.log(`  [${m.id}] ${m.category} | ${m.brand} ${m.name} → ${m.mapping_count} mappings`);
}

// 3. Sample the actual mapped URLs for the most-mapped generics
if (mappings.length > 0) {
  const topId = mappings[0].id;
  const urls = await sql`
    SELECT sm.product_url, r.name as retailer
    FROM scraper_mappings sm
    JOIN retailers r ON r.id = sm.retailer_id
    WHERE sm.component_id = ${topId}
    LIMIT 10
  ` as { product_url: string; retailer: string }[];
  console.log(`\n=== Sample URLs mapped to [${topId}] ${mappings[0].name} ===`);
  for (const u of urls) {
    console.log(`  [${u.retailer}] ${u.product_url}`);
  }
}

// 4. Category breakdown
const breakdown = await sql`
  SELECT category, COUNT(*) as total,
    COUNT(CASE WHEN brand ILIKE '%generic%' OR name ILIKE '%generic%' THEN 1 END) as generic_count
  FROM components
  GROUP BY category ORDER BY category
` as { category: string; total: number; generic_count: number }[];

console.log(`\n=== Catalog breakdown ===`);
for (const b of breakdown) {
  console.log(`  ${b.category}: ${b.total} total, ${b.generic_count} generic`);
}

process.exit(0);
