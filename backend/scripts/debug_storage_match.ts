/**
 * Debug why new storage catalog entries aren't matching scraped products.
 */
import { sql } from 'bun';
import { scoreDnaMatch, extractDna, type CatalogComponent } from '../src/utils/componentMatcher.js';

// Get a sample of new storage entries (created by catalogBuilder)
const newStorage = await sql`
  SELECT id, name, brand FROM components
  WHERE category = 'storage' AND is_active = true AND id > 800
  ORDER BY id LIMIT 20
` as { id: number; name: string; brand: string }[];

// Get some unmatched storage listings
const unmatched = await sql`
  SELECT ul.scraped_name, r.name AS retailer
  FROM unmatched_listings ul
  JOIN retailers r ON r.id = ul.retailer_id
  WHERE ul.status = 'pending'
    AND ul.scraped_name ILIKE '%adata%legend%'
  LIMIT 10
` as { scraped_name: string; retailer: string }[];

console.log('=== New storage catalog entries ===');
for (const c of newStorage.slice(0, 5)) {
  const dna = extractDna(`${c.brand} ${c.name}`, 'storage');
  console.log(`  [${c.id}] ${c.brand} ${c.name}`);
  console.log(`    DNA: ${JSON.stringify(dna)}`);
}

console.log('\n=== Unmatched ADATA LEGEND listings ===');
for (const u of unmatched) {
  console.log(`  [${u.retailer}] "${u.scraped_name}"`);
  // Try to match against catalog
  for (const c of newStorage) {
    const { score, dnaTokens } = scoreDnaMatch(u.scraped_name, `${c.brand} ${c.name}`, 'storage');
    if (score >= 0.8) {
      console.log(`    → MATCH (${score.toFixed(2)}) [${c.id}] ${c.brand} ${c.name} | tokens: ${dnaTokens}`);
    }
  }
}

// Check what DNA the catalog entries have
console.log('\n=== DNA of specific catalog entries ===');
const specific = await sql`
  SELECT id, name, brand FROM components
  WHERE category = 'storage' AND name ILIKE '%legend 710%1tb%'
  LIMIT 5
` as { id: number; name: string; brand: string }[];

for (const c of specific) {
  const dna = extractDna(`${c.brand} ${c.name}`, 'storage');
  console.log(`  [${c.id}] ${c.brand} ${c.name}`);
  console.log(`    DNA: ${JSON.stringify(dna)}`);
}

process.exit(0);
