/**
 * Merge duplicate components (same brand + name after cleaning).
 * Keeps the component with the lowest ID (or the one with an image),
 * redirects all prices and scraper_mappings to it, then deletes the duplicate.
 *
 * Run after cleaning component names:
 *   bun run scripts/tools/merge_duplicates.ts
 */
import { sql as bunSql } from 'bun';

console.log('🔀 Merging Duplicate Components\n');

// Find all exact duplicates (same brand + name, case-insensitive)
const duplicateGroups = await bunSql`
  SELECT
    LOWER(TRIM(COALESCE(brand, ''))) as brand_lower,
    LOWER(TRIM(name)) as name_lower,
    array_agg(id ORDER BY
      CASE WHEN image_url IS NOT NULL THEN 0 ELSE 1 END,  -- prefer one with image
      id ASC                                               -- then lowest ID
    ) as ids,
    array_agg(name ORDER BY
      CASE WHEN image_url IS NOT NULL THEN 0 ELSE 1 END,
      id ASC
    ) as names,
    array_agg(COALESCE(image_url, '') ORDER BY
      CASE WHEN image_url IS NOT NULL THEN 0 ELSE 1 END,
      id ASC
    ) as images
  FROM components
  WHERE is_active = true
  GROUP BY LOWER(TRIM(COALESCE(brand, ''))), LOWER(TRIM(name))
  HAVING COUNT(*) > 1
  ORDER BY brand_lower, name_lower
` as { brand_lower: string; name_lower: string; ids: number[]; names: string[]; images: string[] }[];

console.log(`Found ${duplicateGroups.length} groups of duplicates\n`);

if (duplicateGroups.length === 0) {
    console.log('✅ No duplicates found!');
    process.exit(0);
}

let merged = 0;
let errors = 0;

for (const group of duplicateGroups) {
    const keepId = group.ids[0];       // Keep first (has image or lowest ID)
    const dupeIds = group.ids.slice(1); // Delete the rest

    console.log(`Merging: "${group.brand_lower} ${group.name_lower}"`);
    console.log(`  Keep:   ID ${keepId} (${group.names[0]}) image: ${group.images[0] ? '✅' : '❌'}`);
    dupeIds.forEach((id, i) => {
        console.log(`  Delete: ID ${id} (${group.names[i + 1]}) image: ${group.images[i + 1] ? '✅' : '❌'}`);
    });

    try {
        for (const dupeId of dupeIds) {
            // If the dupe has an image but the keeper doesn't, copy it first
            if (group.images[0] === '' && group.images[group.ids.indexOf(dupeId)] !== '') {
                await bunSql`UPDATE components SET image_url = ${group.images[group.ids.indexOf(dupeId)]} WHERE id = ${keepId} AND image_url IS NULL`;
            }

            // Redirect prices to the keeper (delete conflicting rows first)
            await bunSql`
              DELETE FROM prices
              WHERE component_id = ${dupeId}
                AND product_url IN (SELECT product_url FROM prices WHERE component_id = ${keepId})
            `;
            await bunSql`UPDATE prices SET component_id = ${keepId} WHERE component_id = ${dupeId}`;

            // Redirect scraper_mappings to the keeper (delete conflicting rows first)
            await bunSql`
              DELETE FROM scraper_mappings
              WHERE component_id = ${dupeId}
                AND product_url IN (SELECT product_url FROM scraper_mappings WHERE component_id = ${keepId})
            `;
            await bunSql`UPDATE scraper_mappings SET component_id = ${keepId} WHERE component_id = ${dupeId}`;

            // Redirect price_history
            await bunSql`UPDATE price_history SET component_id = ${keepId} WHERE component_id = ${dupeId}`;

            // Redirect unmatched_listings
            await bunSql`UPDATE unmatched_listings SET linked_component_id = ${keepId} WHERE linked_component_id = ${dupeId}`;

            // Delete the duplicate component
            await bunSql`DELETE FROM components WHERE id = ${dupeId}`;

            merged++;
        }
        console.log(`  ✅ Merged\n`);
    } catch (err) {
        console.error(`  ❌ Error: ${err}\n`);
        errors++;
    }
}

console.log(`\n📊 Results:`);
console.log(`   Merged:  ${merged} duplicates removed`);
console.log(`   Errors:  ${errors}`);

const stats = await bunSql`SELECT COUNT(*) as total FROM components WHERE is_active = true` as any[];
console.log(`   Total components remaining: ${stats[0].total}`);
console.log('\n✅ Done!\n');
process.exit(0);
