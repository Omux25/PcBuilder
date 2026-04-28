/**
 * analyze_generics.ts — show what real products are mapped to generic entries
 * so we know exactly which catalog entries to add.
 */
import { sql } from 'bun';

// Get all scraped product names mapped to generic components, grouped by chipset
const rows = await sql`
  SELECT
    c.id        AS component_id,
    c.category,
    c.name      AS generic_name,
    sm.product_url,
    r.name      AS retailer,
    ul.scraped_name,
    p.price
  FROM scraper_mappings sm
  JOIN components c ON c.id = sm.component_id
  JOIN retailers r ON r.id = sm.retailer_id
  LEFT JOIN prices p ON p.component_id = sm.component_id AND p.retailer_id = sm.retailer_id AND p.product_url = sm.product_url
  LEFT JOIN unmatched_listings ul ON ul.product_url = sm.product_url AND ul.retailer_id = sm.retailer_id
  WHERE c.brand ILIKE '%generic%' OR c.name ILIKE '%generic%'
  ORDER BY c.category, c.name, r.name
` as {
  component_id: number; category: string; generic_name: string;
  product_url: string; retailer: string; scraped_name: string | null; price: number | null;
}[];

// Group by generic component
const grouped = new Map<string, typeof rows>();
for (const row of rows) {
  const key = `[${row.component_id}] ${row.generic_name}`;
  if (!grouped.has(key)) grouped.set(key, []);
  grouped.get(key)!.push(row);
}

for (const [key, items] of grouped) {
  console.log(`\n${key} (${items.length} mappings):`);
  for (const item of items.slice(0, 8)) {
    const name = item.scraped_name ?? item.product_url.split('/').pop() ?? item.product_url;
    const price = item.price ? ` — ${item.price} MAD` : '';
    console.log(`  [${item.retailer}] ${name}${price}`);
  }
  if (items.length > 8) console.log(`  ... and ${items.length - 8} more`);
}

process.exit(0);
