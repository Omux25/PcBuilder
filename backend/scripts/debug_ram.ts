/**
 * Debug RAM coverage — find what's in the catalog, what's priced,
 * what's unmatched, and why the DNA matcher isn't linking them.
 */
import { sql } from 'bun';
import { scoreDnaMatch, extractDna } from '../src/utils/componentMatcher.js';

// 1. Catalog RAM entries
const catalog = await sql`
  SELECT c.id, c.name, c.brand, c.ram_type, c.frequency_mhz,
    COUNT(p.id)::int AS price_count
  FROM components c
  LEFT JOIN prices p ON p.component_id = c.id
  WHERE c.category = 'ram' AND c.is_active = true
  GROUP BY c.id, c.name, c.brand, c.ram_type, c.frequency_mhz
  ORDER BY price_count DESC, c.name
` as { id: number; name: string; brand: string; ram_type: string; frequency_mhz: number; price_count: number }[];

console.log(`\n=== RAM catalog (${catalog.length} entries) ===`);
const withPrices = catalog.filter(c => c.price_count > 0);
const noPrices   = catalog.filter(c => c.price_count === 0);
console.log(`With prices: ${withPrices.length}`);
console.log(`No prices:   ${noPrices.length}`);

console.log('\nNo prices:');
noPrices.forEach(c => console.log(`  [${c.id}] ${c.brand} ${c.name} | ${c.ram_type} ${c.frequency_mhz}MHz`));

// 2. Unmatched RAM listings
const unmatched = await sql`
  SELECT ul.scraped_name, ul.scraped_price, r.name AS retailer
  FROM unmatched_listings ul
  JOIN retailers r ON r.id = ul.retailer_id
  WHERE ul.status = 'pending'
    AND (ul.scraped_name ILIKE '%ddr4%' OR ul.scraped_name ILIKE '%ddr5%'
         OR ul.scraped_name ILIKE '%dimm%' OR ul.scraped_name ILIKE '%vengeance%'
         OR ul.scraped_name ILIKE '%ripjaws%' OR ul.scraped_name ILIKE '%fury%'
         OR ul.scraped_name ILIKE '%trident%')
  ORDER BY ul.scraped_name
  LIMIT 30
` as { scraped_name: string; scraped_price: number; retailer: string }[];

console.log(`\n=== Unmatched RAM listings (sample of ${unmatched.length}) ===`);
for (const u of unmatched) {
  console.log(`  [${u.retailer}] ${u.scraped_price} MAD — "${u.scraped_name}"`);
}

// 3. DNA match test — why aren't they matching?
console.log('\n=== DNA match test ===');
const testCases = [
  'Corsair Vengeance DDR5-5600 32GB',
  'G.Skill Trident Z5 32GB DDR5-6000',
  'Kingston FURY Beast 32GB DDR4-3600',
  'Corsair Vengeance LPX 16GB DDR4-3200',
];

for (const scraped of testCases) {
  console.log(`\nScraped: "${scraped}"`);
  const dna = extractDna(scraped, 'ram');
  console.log(`  DNA: ${JSON.stringify(dna)}`);

  let bestScore = 0;
  let bestMatch = '';
  for (const c of catalog) {
    const fullName = `${c.brand} ${c.name}`;
    const { score } = scoreDnaMatch(scraped, fullName, 'ram');
    if (score > bestScore) {
      bestScore = score;
      bestMatch = fullName;
    }
  }
  console.log(`  Best match: "${bestMatch}" (score=${bestScore.toFixed(2)})`);
}

// 4. Check what the actual unmatched RAM looks like vs catalog
if (unmatched.length > 0) {
  console.log('\n=== Matching unmatched RAM against catalog ===');
  for (const u of unmatched.slice(0, 10)) {
    let bestScore = 0;
    let bestMatch = '';
    let bestId = 0;
    for (const c of catalog) {
      const fullName = `${c.brand} ${c.name}`;
      const { score } = scoreDnaMatch(u.scraped_name, fullName, 'ram');
      if (score > bestScore) {
        bestScore = score;
        bestMatch = fullName;
        bestId = c.id;
      }
    }
    const status = bestScore >= 1.0 ? '✓ MATCH' : bestScore >= 0.5 ? '~ PARTIAL' : '✗ NO MATCH';
    console.log(`  ${status} (${bestScore.toFixed(2)}): "${u.scraped_name}"`);
    if (bestScore > 0) console.log(`    → [${bestId}] ${bestMatch}`);
  }
}

process.exit(0);
