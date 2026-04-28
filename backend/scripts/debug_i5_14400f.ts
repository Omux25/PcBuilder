import { sql } from 'bun';
import { scoreDnaMatch } from '../src/utils/componentMatcher.js';

// Find catalog entries
const components = await sql`
  SELECT id, name, brand, socket FROM components
  WHERE (name ILIKE '%14400%' OR name ILIKE '%i5-14400%')
    AND category = 'cpu'
  ORDER BY id
` as { id: number; name: string; brand: string; socket: string }[];

console.log('=== Catalog entries ===');
for (const c of components) {
  console.log(`  [${c.id}] ${c.brand} ${c.name} | socket=${c.socket}`);
}

// Prices for each
for (const c of components) {
  const prices = await sql`
    SELECT p.price, p.in_stock, p.product_url, p.variant_label, r.name AS retailer, p.last_updated
    FROM prices p
    JOIN retailers r ON r.id = p.retailer_id
    WHERE p.component_id = ${c.id}
    ORDER BY p.price
  ` as any[];

  console.log(`\n  Prices for [${c.id}] ${c.name}:`);
  if (prices.length === 0) console.log('    (none)');
  for (const p of prices) {
    console.log(`    ${p.retailer}: ${p.price} MAD | in_stock=${p.in_stock}`);
    console.log(`    URL: ${p.product_url}`);
  }
}

// Mappings for each
for (const c of components) {
  const mappings = await sql`
    SELECT sm.product_url, sm.product_identifier, r.name AS retailer
    FROM scraper_mappings sm
    JOIN retailers r ON r.id = sm.retailer_id
    WHERE sm.component_id = ${c.id}
  ` as any[];

  console.log(`\n  Mappings for [${c.id}] ${c.name}:`);
  if (mappings.length === 0) console.log('    (none)');
  for (const m of mappings) {
    console.log(`    [${m.retailer}] "${m.product_identifier}"`);
    console.log(`    URL: ${m.product_url}`);
  }
}

// DNA match test
const scrapedName = "Intel Core I5-14400F (Jusqu'a 4.7 GHz) TRAY";
console.log(`\n=== DNA match for "${scrapedName}" ===`);
for (const c of components) {
  const { score, dnaTokens } = scoreDnaMatch(scrapedName, `${c.brand} ${c.name}`, 'cpu');
  console.log(`  vs [${c.id}] "${c.brand} ${c.name}" → score=${score.toFixed(2)} tokens=${JSON.stringify(dnaTokens)}`);
}

// Unmatched listings
const unmatched = await sql`
  SELECT ul.scraped_name, ul.scraped_price, ul.status, r.name AS retailer
  FROM unmatched_listings ul
  JOIN retailers r ON r.id = ul.retailer_id
  WHERE ul.scraped_name ILIKE '%14400%'
  ORDER BY ul.scraped_at DESC
  LIMIT 10
` as any[];

console.log('\n=== Unmatched listings ===');
for (const u of unmatched) {
  console.log(`  [${u.status}] ${u.retailer} | "${u.scraped_name}" | ${u.scraped_price} MAD`);
}

process.exit(0);
