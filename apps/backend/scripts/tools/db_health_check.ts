/**
 * Comprehensive database health check.
 * Checks for data integrity issues, suspicious prices, orphaned records,
 * and anything that would cause wrong data to show in the UI.
 */
import { sql } from 'bun';

let issues = 0;
let warnings = 0;
function fail(msg: string)  { console.error(`  ✗ ${msg}`); issues++; }
function warn(msg: string)  { console.warn(`  ⚠ ${msg}`); warnings++; }
function ok(msg: string)    { console.log(`  ✓ ${msg}`); }

// ── 1. Prices pointing to inactive components ─────────────────────────────────
console.log('\n=== Prices pointing to inactive components ===');
const pricesInactive = await sql`
  SELECT COUNT(*)::int AS cnt FROM prices p
  JOIN components c ON c.id = p.component_id
  WHERE c.is_active = false
` as { cnt: number }[];
if (pricesInactive[0].cnt > 0) fail(`${pricesInactive[0].cnt} price rows point to inactive components`);
else ok('No prices pointing to inactive components');

// ── 2. Mappings pointing to inactive components ───────────────────────────────
console.log('\n=== Mappings pointing to inactive components ===');
const mappingsInactive = await sql`
  SELECT COUNT(*)::int AS cnt FROM scraper_mappings sm
  JOIN components c ON c.id = sm.component_id
  WHERE c.is_active = false
` as { cnt: number }[];
if (mappingsInactive[0].cnt > 0) fail(`${mappingsInactive[0].cnt} mappings point to inactive components`);
else ok('No mappings pointing to inactive components');

// ── 3. Suspiciously low prices per category ───────────────────────────────────
console.log('\n=== Suspiciously low prices ===');
const thresholds: Record<string, number> = {
  cpu: 300, gpu: 500, motherboard: 400, ram: 100,
  storage: 80, psu: 200, case: 200, cooling: 100,
};
for (const [cat, min] of Object.entries(thresholds)) {
  const low = await sql`
    SELECT p.price, p.product_url, c.name, r.name AS retailer
    FROM prices p
    JOIN components c ON c.id = p.component_id
    JOIN retailers r ON r.id = p.retailer_id
    WHERE c.category = ${cat} AND p.price < ${min} AND p.in_stock = true
    ORDER BY p.price ASC
    LIMIT 5
  ` as { price: number; product_url: string; name: string; retailer: string }[];
  if (low.length > 0) {
    low.forEach(p => warn(`[${cat}] ${p.retailer}: ${p.price} MAD for "${p.name}" — below ${min} MAD threshold`));
  }
}
if (warnings === 0) ok('No suspiciously low prices found');

// ── 4. Suspiciously high prices ───────────────────────────────────────────────
console.log('\n=== Suspiciously high prices (> 50,000 MAD) ===');
const high = await sql`
  SELECT p.price, c.name, c.category, r.name AS retailer
  FROM prices p
  JOIN components c ON c.id = p.component_id
  JOIN retailers r ON r.id = p.retailer_id
  WHERE p.price > 50000
  ORDER BY p.price DESC LIMIT 10
` as { price: number; name: string; category: string; retailer: string }[];
if (high.length > 0) high.forEach(p => warn(`${p.retailer}: ${p.price} MAD for [${p.category}] "${p.name}"`));
else ok('No prices above 50,000 MAD');

// ── 5. Duplicate prices (same component, retailer, URL) ──────────────────────
console.log('\n=== Duplicate price rows ===');
const dupePrices = await sql`
  SELECT component_id, retailer_id, product_url, COUNT(*)::int AS cnt
  FROM prices
  GROUP BY component_id, retailer_id, product_url
  HAVING COUNT(*) > 1
  LIMIT 5
` as { component_id: number; retailer_id: number; product_url: string; cnt: number }[];
if (dupePrices.length > 0) dupePrices.forEach(d => fail(`Duplicate price: component=${d.component_id} retailer=${d.retailer_id} (${d.cnt}x)`));
else ok('No duplicate price rows');

// ── 6. Prices with no corresponding mapping ───────────────────────────────────
console.log('\n=== Prices with no scraper_mapping ===');
const pricesNoMapping = await sql`
  SELECT COUNT(*)::int AS cnt FROM prices p
  WHERE NOT EXISTS (
    SELECT 1 FROM scraper_mappings sm
    WHERE sm.component_id = p.component_id
      AND sm.retailer_id = p.retailer_id
      AND sm.product_url = p.product_url
  )
` as { cnt: number }[];
if (pricesNoMapping[0].cnt > 0) warn(`${pricesNoMapping[0].cnt} price rows have no corresponding scraper_mapping`);
else ok('All price rows have a corresponding scraper_mapping');

// ── 7. Components with wrong category specs ───────────────────────────────────
console.log('\n=== Required field checks ===');
const cpuNoSocket = await sql`SELECT COUNT(*)::int AS cnt FROM components WHERE category='cpu' AND is_active=true AND (socket IS NULL OR socket='')` as {cnt:number}[];
const gpuNoLength = await sql`SELECT COUNT(*)::int AS cnt FROM components WHERE category='gpu' AND is_active=true AND (length_mm IS NULL OR length_mm=0)` as {cnt:number}[];
const ramNoType   = await sql`SELECT COUNT(*)::int AS cnt FROM components WHERE category='ram' AND is_active=true AND ram_type IS NULL` as {cnt:number}[];
const mbNoSocket  = await sql`SELECT COUNT(*)::int AS cnt FROM components WHERE category='motherboard' AND is_active=true AND (socket IS NULL OR socket='')` as {cnt:number}[];
const psuNoWatt   = await sql`SELECT COUNT(*)::int AS cnt FROM components WHERE category='psu' AND is_active=true AND (wattage IS NULL OR wattage=0)` as {cnt:number}[];

if (cpuNoSocket[0].cnt > 0) fail(`${cpuNoSocket[0].cnt} CPUs missing socket`);
else ok('All CPUs have socket');
if (gpuNoLength[0].cnt > 0) fail(`${gpuNoLength[0].cnt} GPUs missing length_mm`);
else ok('All GPUs have length_mm');
if (ramNoType[0].cnt > 0) fail(`${ramNoType[0].cnt} RAM entries missing ram_type`);
else ok('All RAM entries have ram_type');
if (mbNoSocket[0].cnt > 0) fail(`${mbNoSocket[0].cnt} motherboards missing socket`);
else ok('All motherboards have socket');
if (psuNoWatt[0].cnt > 0) warn(`${psuNoWatt[0].cnt} PSUs missing wattage`);
else ok('All PSUs have wattage');

// ── 8. Stale prices (not updated in > 7 days) ─────────────────────────────────
console.log('\n=== Stale prices (not updated in > 7 days) ===');
const stale = await sql`
  SELECT r.name AS retailer, COUNT(*)::int AS cnt,
    MAX(p.last_updated) AS last_update
  FROM prices p
  JOIN retailers r ON r.id = p.retailer_id
  WHERE p.last_updated < NOW() - INTERVAL '7 days'
  GROUP BY r.name
` as { retailer: string; cnt: number; last_update: string }[];
if (stale.length > 0) stale.forEach(s => warn(`${s.retailer}: ${s.cnt} prices not updated since ${new Date(s.last_update).toLocaleDateString()}`));
else ok('All prices updated within 7 days');

// ── 9. Price range sanity per category ───────────────────────────────────────
console.log('\n=== Price range per category (in-stock only) ===');
const ranges = await sql`
  SELECT c.category,
    COUNT(*)::int AS offers,
    MIN(p.price)::numeric(10,2) AS min_price,
    MAX(p.price)::numeric(10,2) AS max_price,
    ROUND(AVG(p.price))::int AS avg_price
  FROM prices p
  JOIN components c ON c.id = p.component_id
  WHERE p.in_stock = true AND c.is_active = true
  GROUP BY c.category ORDER BY c.category
` as { category: string; offers: number; min_price: number; max_price: number; avg_price: number }[];
for (const r of ranges) {
  console.log(`  ${r.category.padEnd(12)} ${r.offers.toString().padStart(4)} offers | ${r.min_price.toString().padStart(7)} – ${r.max_price.toString().padStart(7)} MAD | avg ${r.avg_price} MAD`);
}

// ── 10. Orphaned unmatched listings (linked but mapping deleted) ──────────────
console.log('\n=== Orphaned linked listings ===');
const orphaned = await sql`
  SELECT COUNT(*)::int AS cnt FROM unmatched_listings ul
  WHERE ul.status = 'linked'
    AND ul.linked_component_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM scraper_mappings sm
      WHERE sm.product_url = ul.product_url
        AND sm.retailer_id = ul.retailer_id
    )
` as { cnt: number }[];
if (orphaned[0].cnt > 0) warn(`${orphaned[0].cnt} listings marked 'linked' but have no scraper_mapping`);
else ok('No orphaned linked listings');

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${'='.repeat(50)}`);
console.log(`Issues: ${issues} | Warnings: ${warnings}`);
if (issues === 0 && warnings === 0) console.log('Database is healthy.');
else if (issues === 0) console.log('No critical issues. Review warnings above.');

process.exit(issues > 0 ? 1 : 0);
