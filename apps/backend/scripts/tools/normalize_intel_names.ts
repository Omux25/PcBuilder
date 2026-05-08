/**
 * Normalize Intel CPU names in the database:
 * "Core i3-10100F" → "Core i3 10100F"
 * "Core i5-12400F" → "Core i5 12400F"
 */
import { sql as bunSql } from 'bun';

console.log('🔧 Normalizing Intel CPU names\n');

// Find all Intel CPU components with a dash in the name
const toFix = await bunSql`
  SELECT id, name, brand
  FROM components
  WHERE brand = 'Intel' AND name LIKE '%i_-%'
  ORDER BY id
` as { id: number; name: string; brand: string | null }[];

console.log(`Found ${toFix.length} components to fix\n`);

let updated = 0;
for (const c of toFix) {
    // Replace "iX-NNNNN" with "iX NNNNN" (dash between i-number and model number)
    const newName = c.name.replace(/(i\d)-(\d)/g, '$1 $2');
    if (newName !== c.name) {
        await bunSql`UPDATE components SET name = ${newName} WHERE id = ${c.id}`;
        updated++;
        if (updated <= 15) {
            console.log(`  ✅ "${c.name}" → "${newName}"`);
        }
    }
}

if (updated > 15) console.log(`  ... and ${updated - 15} more`);

console.log(`\n📊 Updated ${updated} components`);

// Check for new duplicates
const newDupes = await bunSql`
  SELECT LOWER(TRIM(COALESCE(brand,''))) as b, LOWER(TRIM(name)) as n, COUNT(*) as cnt,
    array_agg(id ORDER BY id) as ids
  FROM components
  WHERE is_active = true
  GROUP BY LOWER(TRIM(COALESCE(brand,''))), LOWER(TRIM(name))
  HAVING COUNT(*) > 1
` as { b: string; n: string; cnt: string; ids: number[] }[];

if (newDupes.length > 0) {
    console.log(`\n⚠️  ${newDupes.length} new duplicates — run merge_duplicates.ts next`);
    newDupes.slice(0, 5).forEach(d => console.log(`  "${d.b} ${d.n}" (IDs: ${d.ids.join(', ')})`));
} else {
    console.log('✅ No new duplicates created');
}

process.exit(0);
