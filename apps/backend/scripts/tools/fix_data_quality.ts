/**
 * Fix data quality issues found in audit:
 * 1. Fix miscategorized components (RAM/DDR in storage category)
 * 2. Restore images that were incorrectly cleared (GHz in NextLevel URLs is normal)
 * 3. Fix RAM names — keep MHz (it's the product identifier) but strip CL/latency specs
 *    and model numbers like (AD5U560016G-S)
 *
 * Run: bun run scripts/tools/fix_data_quality.ts
 */
import { sql as bunSql } from 'bun';

let totalFixes = 0;
console.log('🔧 Fixing data quality issues\n');

// ── 1. Fix miscategorized RAM in storage ─────────────────────────────────────
console.log('1. Fixing miscategorized RAM in storage category...');
const miscat = await bunSql`
  SELECT id, name, brand FROM components
  WHERE category = 'storage'
    AND (name ILIKE '%DDR4%' OR name ILIKE '%DDR5%' OR name ILIKE '%MHz%' OR name ILIKE '%MHZ%')
` as any[];

console.log(`   Found ${miscat.length} RAM components in storage category`);
if (miscat.length > 0) {
    await bunSql`
    UPDATE components SET category = 'ram'
    WHERE category = 'storage'
      AND (name ILIKE '%DDR4%' OR name ILIKE '%DDR5%' OR name ILIKE '%MHz%' OR name ILIKE '%MHZ%')
  `;
    miscat.slice(0, 5).forEach((c: any) => console.log(`   ✅ Moved to RAM: ${c.brand} ${c.name}`));
    if (miscat.length > 5) console.log(`   ... and ${miscat.length - 5} more`);
    totalFixes += miscat.length;
}

// ── 2. Fix RAM names — strip CL specs and model numbers, keep MHz ─────────────
// RAM names SHOULD keep MHz (it's the product identifier)
// But should strip: CL16, CL40, model numbers like (AD5U560016G-S), | AG16GB...
console.log('\n2. Cleaning RAM names (strip CL specs and model numbers)...');
const ramNames = await bunSql`
  SELECT id, name, brand FROM components
  WHERE category = 'ram'
    AND (name LIKE '%CL%' OR name LIKE '%| %' OR name LIKE '%(A%' OR name LIKE '%(AD%')
  LIMIT 300
` as any[];

console.log(`   Found ${ramNames.length} RAM names to clean`);
let ramFixed = 0;
for (const c of ramNames) {
    let clean = c.name;
    // Remove CL specs: CL16, CL40, CL-40-40-40, CL36-38-38
    clean = clean.replace(/\s+CL[\d-]+\b/gi, '');
    // Remove model numbers after pipe: | AG16GB32C16S4UB
    clean = clean.replace(/\s*\|\s*[A-Z0-9_-]{6,}\s*$/g, '');
    // Remove parenthetical model numbers: (AD5U560016G-S), (ADA4U320016G22)
    clean = clean.replace(/\s*\([A-Z]{2,}[A-Z0-9_-]{4,}\)\s*/g, '');
    // Remove "Mémoire avec Heatsink" suffix
    clean = clean.replace(/\s+Mémoire avec Heatsink\s*$/gi, '');
    clean = clean.replace(/\s+/g, ' ').trim();
    if (clean !== c.name && clean.length > 3) {
        await bunSql`UPDATE components SET name = ${clean} WHERE id = ${c.id}`;
        ramFixed++;
        if (ramFixed <= 5) console.log(`   ✅ "${c.name}" → "${clean}"`);
    }
}
if (ramFixed > 5) console.log(`   ... and ${ramFixed - 5} more`);
console.log(`   Fixed ${ramFixed} RAM names`);
totalFixes += ramFixed;

// ── 3. Restore images cleared by the GHz filter ──────────────────────────────
// We incorrectly cleared NextLevel images that had GHz in the filename.
// NextLevel uses GHz in ALL their image filenames — it's not a sign of a broken URL.
// The real broken ones were already replaced. Now we need to restore the ones we cleared.
// Strategy: find components with no image that have NextLevel mappings,
// and check if the scraper_mappings URL pattern suggests a NextLevel image exists.
// We'll reconstruct the image URL from the product URL pattern.
console.log('\n3. Checking for incorrectly cleared NextLevel images...');

// NextLevel image URL pattern: /NNNNN-home_default/product-slug.jpg
// Product URL pattern: /category/NNNNN-product-slug.html
// We can reconstruct: extract NNNNN from product URL, build image URL

const nextlevelNoImage = await bunSql`
  SELECT c.id, c.name, c.brand, sm.product_url
  FROM components c
  JOIN scraper_mappings sm ON sm.component_id = c.id
  JOIN retailers r ON r.id = sm.retailer_id
  WHERE c.image_url IS NULL AND c.is_active = true AND r.name = 'NextLevel PC'
  ORDER BY c.id
` as any[];

console.log(`   Found ${nextlevelNoImage.length} NextLevel-mapped components without images`);
console.log(`   (These need a fresh scrape to get images — cannot reconstruct from URL alone)`);
console.log(`   Run backfill_images.ts after this to populate them`);

// ── 4. Fix PSU components miscategorized as RAM ───────────────────────────────
console.log('\n4. Checking for PSU components miscategorized as RAM...');
const psuInRam = await bunSql`
  SELECT id, name, brand FROM components
  WHERE category = 'ram'
    AND (name ILIKE '%DDR4%' OR name ILIKE '%DDR5%')
    AND brand IN ('TeamGroup', 'Team Group', 'Viper Gaming', 'Patriot')
    AND name ILIKE '%Elite%'
  LIMIT 10
` as any[];
// Actually check the original PSU miscategorization from audit
const psuMiscat = await bunSql`
  SELECT id, name, brand, category FROM components
  WHERE category = 'psu'
    AND (name ILIKE '%DDR4%' OR name ILIKE '%DDR5%' OR name ILIKE '%MHz%')
` as any[];
console.log(`   PSU-categorized RAM: ${psuMiscat.length}`);
if (psuMiscat.length > 0) {
    await bunSql`
    UPDATE components SET category = 'ram'
    WHERE category = 'psu'
      AND (name ILIKE '%DDR4%' OR name ILIKE '%DDR5%' OR name ILIKE '%MHz%')
  `;
    psuMiscat.forEach((c: any) => console.log(`   ✅ Moved to RAM: ${c.brand} ${c.name}`));
    totalFixes += psuMiscat.length;
}

// ── 5. Merge any new duplicates created ──────────────────────────────────────
console.log('\n5. Merging any duplicates...');
const dupes = await bunSql`
  SELECT array_agg(id ORDER BY CASE WHEN image_url IS NOT NULL THEN 0 ELSE 1 END, id ASC) as ids
  FROM components WHERE is_active = true
  GROUP BY LOWER(TRIM(COALESCE(brand,''))), LOWER(TRIM(name))
  HAVING COUNT(*) > 1
` as any[];

console.log(`   Found ${dupes.length} duplicate groups`);
let merged = 0;
for (const g of dupes) {
    const keepId = g.ids[0];
    for (const dupeId of g.ids.slice(1)) {
        try {
            await bunSql`DELETE FROM prices WHERE component_id = ${dupeId} AND product_url IN (SELECT product_url FROM prices WHERE component_id = ${keepId})`;
            await bunSql`UPDATE prices SET component_id = ${keepId} WHERE component_id = ${dupeId}`;
            await bunSql`DELETE FROM scraper_mappings WHERE component_id = ${dupeId} AND product_url IN (SELECT product_url FROM scraper_mappings WHERE component_id = ${keepId})`;
            await bunSql`UPDATE scraper_mappings SET component_id = ${keepId} WHERE component_id = ${dupeId}`;
            await bunSql`UPDATE price_history SET component_id = ${keepId} WHERE component_id = ${dupeId}`;
            await bunSql`UPDATE unmatched_listings SET linked_component_id = ${keepId} WHERE linked_component_id = ${dupeId}`;
            await bunSql`DELETE FROM components WHERE id = ${dupeId}`;
            merged++;
        } catch { /* skip */ }
    }
}
console.log(`   Merged ${merged} duplicates`);
totalFixes += merged;

// ── Final stats ───────────────────────────────────────────────────────────────
const stats = await bunSql`
  SELECT COUNT(*) as total, COUNT(image_url) as with_images FROM components WHERE is_active = true
` as any[];
const pct = Math.round(parseInt(stats[0].with_images) / parseInt(stats[0].total) * 100);

console.log(`\n📊 Results:`);
console.log(`   Total fixes: ${totalFixes}`);
console.log(`   Components: ${stats[0].total}`);
console.log(`   Image coverage: ${stats[0].with_images}/${stats[0].total} (${pct}%)`);
console.log('\n✅ Done! Run backfill_images.ts to populate missing NextLevel images.');

process.exit(0);
