import { sql } from 'bun';

// What retailers are in the DB?
const retailers = await sql`
  SELECT id, name, base_url, is_active FROM retailers ORDER BY id
` as { id: number; name: string; base_url: string; is_active: boolean }[];

console.log('=== Retailers in DB ===');
retailers.forEach(r => console.log(`  [${r.id}] ${r.name} — ${r.base_url} (active: ${r.is_active})`));

// What retailer IDs actually have prices?
const withPrices = await sql`
  SELECT r.id, r.name, COUNT(p.id) AS price_count
  FROM retailers r
  LEFT JOIN prices p ON p.retailer_id = r.id
  GROUP BY r.id, r.name
  ORDER BY r.id
` as { id: number; name: string; price_count: string }[];

console.log('\n=== Price counts per retailer ===');
withPrices.forEach(r => console.log(`  [${r.id}] ${r.name}: ${r.price_count} prices`));

// Check BOX+Tray both mapped for same component at same retailer
console.log('\n=== CPUs with both BOX and Tray at same retailer ===');
const both = await sql`
  SELECT c.name, r.name AS retailer, COUNT(p.id) AS variants,
    array_agg(p.variant_label ORDER BY p.price) AS labels,
    array_agg(p.price ORDER BY p.price) AS prices
  FROM prices p
  JOIN components c ON c.id = p.component_id
  JOIN retailers r ON r.id = p.retailer_id
  WHERE c.category = 'cpu' AND p.variant_label IS NOT NULL
  GROUP BY c.id, c.name, r.id, r.name
  HAVING COUNT(p.id) > 1
  ORDER BY c.name, r.name
  LIMIT 15
` as { name: string; retailer: string; variants: string; labels: string[]; prices: number[] }[];

both.forEach(r => console.log(`  ${r.name} @ ${r.retailer}: [${r.labels.join(', ')}] — ${r.prices.join(', ')} MAD`));
