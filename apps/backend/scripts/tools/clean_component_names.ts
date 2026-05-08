/**
 * Clean component names - remove technical specs like GHz, MHz, TDP
 * Also normalizes Intel CPU names (removes dash between iX and model number)
 *
 * Examples:
 *   "Ryzen 5 5600X (3.7 GHz 4.6 GHz)" → "Ryzen 5 5600X"
 *   "Core i3-10100F (3.6 GHz / 4.3 GHz)" → "Core i3 10100F"
 *   "Core i9 14900 (jusqu'à 5,8 GHz)" → "Core i9 14900"
 */

import { sql as bunSql } from 'bun';

console.log('🧹 Cleaning Component Names\n');

// Find components with specs in names (including French patterns)
const componentsToClean = await bunSql`
  SELECT id, name, brand, category
  FROM components
  WHERE
    name ILIKE '%GHz%' OR
    name ILIKE '%MHz%' OR
    name ILIKE '%MHZ%' OR
    name ILIKE '%GHZ%' OR
    name ILIKE '%- ed' OR
    name ILIKE '%- tray%'
  ORDER BY id
` as { id: number; name: string; brand: string | null; category: string }[];

console.log(`Found ${componentsToClean.length} components with specs in names\n`);

if (componentsToClean.length === 0) {
  console.log('✅ All component names are clean!');
  process.exit(0);
}

let updated = 0;

for (const component of componentsToClean) {
  let cleanName = component.name;

  // Remove French parenthetical specs: (jusqu'à 5.8 GHz), (jusqu'à 4.7 GHz)
  cleanName = cleanName.replace(/\s*\(jusqu['\u2019]?\u00e0?\s*[\d.,]+\s*GHz[^)]*\)/gi, '');
  cleanName = cleanName.replace(/\s*\(jusqu['\u2019]?\s*[\d.,]+\s*GHz[^)]*\)/gi, '');

  // Remove parenthetical specs: (3.7 GHz 4.6 GHz), (3.6 GHz / 4.3 GHz), etc.
  cleanName = cleanName.replace(/\s*\([0-9.,]+\s*(GHz|MHz|W|TDP)[^)]*\)/gi, '');

  // Remove trailing specs: 3200 MHz, 2666 MHZ, etc.
  cleanName = cleanName.replace(/\s+[0-9]+\s*(MHZ|GHZ|mhz|ghz)\s*$/i, '');

  // Remove "- ed" suffix
  cleanName = cleanName.replace(/\s*-\s*ed\s*$/i, '');

  // Remove "- tray" suffix
  cleanName = cleanName.replace(/\s*-\s*tray\s*$/i, ' TRAY');

  // Normalize Intel CPU dash: "Core i5-14400F" → "Core i5 14400F"
  cleanName = cleanName.replace(/(i\d)-(\d)/g, '$1 $2');

  // Clean up extra spaces
  cleanName = cleanName.replace(/\s+/g, ' ').trim();

  if (cleanName !== component.name) {
    await bunSql`UPDATE components SET name = ${cleanName} WHERE id = ${component.id}`;
    updated++;

    if (updated <= 10) {
      console.log(`✅ [${component.category}] ${component.brand}`);
      console.log(`   Before: ${component.name}`);
      console.log(`   After:  ${cleanName}\n`);
    }
  }
}

console.log(`\n📊 Summary:`);
console.log(`   - Updated: ${updated} components`);
console.log(`   - Skipped: ${componentsToClean.length - updated} (already clean)`);

// Check for new duplicates
const newDupes = await bunSql`
  SELECT COUNT(*) as cnt FROM (
    SELECT LOWER(TRIM(COALESCE(brand,''))), LOWER(TRIM(name))
    FROM components WHERE is_active = true
    GROUP BY 1, 2 HAVING COUNT(*) > 1
  ) sub
` as { cnt: string }[];

if (parseInt(newDupes[0].cnt) > 0) {
  console.log(`\n⚠️  ${newDupes[0].cnt} duplicate groups found — run merge_duplicates.ts next`);
} else {
  console.log('\n✅ No duplicates created');
}

process.exit(0);
