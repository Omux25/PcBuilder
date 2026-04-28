/**
 * Find scraped GPU products that should match catalog entries but don't.
 */
import { sql } from 'bun';
import { scoreDnaMatch } from '../src/utils/componentMatcher.js';

// Target GPUs with no prices
const targets = [
  { id: 0, name: 'GeForce RTX 4060', brand: 'NVIDIA', category: 'gpu' },
  { id: 0, name: 'GeForce RTX 4060 Ti 16GB', brand: 'NVIDIA', category: 'gpu' },
  { id: 0, name: 'Radeon RX 7600 XT', brand: 'AMD', category: 'gpu' },
  { id: 0, name: 'Arc B580', brand: 'Intel', category: 'gpu' },
  { id: 0, name: 'Arc B570', brand: 'Intel', category: 'gpu' },
];

// Get their actual IDs
for (const t of targets) {
  const rows = await sql`
    SELECT id FROM components WHERE name = ${t.name} AND brand = ${t.brand} AND category = 'gpu'
  ` as { id: number }[];
  if (rows.length > 0) t.id = rows[0].id;
}

// Find unmatched GPU listings that might match these
const unmatched = await sql`
  SELECT ul.scraped_name, r.name AS retailer, ul.scraped_price
  FROM unmatched_listings ul
  JOIN retailers r ON r.id = ul.retailer_id
  WHERE ul.status = 'pending'
    AND (ul.scraped_name ILIKE '%rtx 4060%'
      OR ul.scraped_name ILIKE '%rx 7600%'
      OR ul.scraped_name ILIKE '%arc b5%'
      OR ul.scraped_name ILIKE '%arc b58%')
  ORDER BY ul.scraped_name
  LIMIT 30
` as { scraped_name: string; retailer: string; scraped_price: number }[];

console.log(`Found ${unmatched.length} unmatched GPU listings:\n`);
for (const u of unmatched) {
  console.log(`  [${u.retailer}] ${u.scraped_price} MAD — "${u.scraped_name}"`);
  // Test against each target
  for (const t of targets) {
    if (t.id === 0) continue;
    const { score, dnaTokens } = scoreDnaMatch(u.scraped_name, `${t.brand} ${t.name}`, 'gpu');
    if (score > 0.5) {
      console.log(`    → score=${score.toFixed(2)} vs [${t.id}] ${t.brand} ${t.name} | tokens=${JSON.stringify(dnaTokens)}`);
    }
  }
}

process.exit(0);
