import { sql } from 'bun';
import { join } from 'path';
import { cleanName } from '../../../../shared/hardware/cleaning';

const curatedPath = join(import.meta.dirname, '../../seed/curated_catalog.json');
const curated = require(curatedPath);

const curatedMbs = curated.components.filter((c: any) => c.category === 'motherboard');

// Build maps for matching
const byImageUrl = new Map<string, any>();
const byNormalizedName = new Map<string, any>();

function normalizeName(brand: string, name: string): string {
  return `${brand} ${name}`.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

for (const mb of curatedMbs) {
  if (mb.image_url) {
    byImageUrl.set(mb.image_url, mb);
  }
  const norm = normalizeName(mb.brand, mb.name);
  byNormalizedName.set(norm, mb);
}

const dbMbs = await sql`
  SELECT id, name, brand, slug, image_url
  FROM components
  WHERE category = 'motherboard' AND is_active = true
`;

console.log(`Matching DB motherboards (${dbMbs.length}) against Curated seed (${curatedMbs.length})...`);

let matchedCount = 0;
let wifiRestored = 0;
const restoredList: string[] = [];

for (const dbMb of dbMbs) {
  // Try matching
  let matched = byImageUrl.get(dbMb.image_url);
  if (!matched) {
    const norm = normalizeName(dbMb.brand, dbMb.name);
    matched = byNormalizedName.get(norm);
  }
  if (!matched) {
    // Try matching by checking if the db name is a substring of curated name
    matched = curatedMbs.find((c: any) => {
      const cNorm = normalizeName(c.brand, c.name);
      const dNorm = normalizeName(dbMb.brand, dbMb.name);
      return cNorm.includes(dNorm) && c.brand.toLowerCase() === dbMb.brand.toLowerCase();
    });
  }

  if (matched) {
    matchedCount++;
    const originalCuratedName = matched.name;
    const cleanedOriginal = cleanName(originalCuratedName, dbMb.brand, 'motherboard');
    
    if (cleanedOriginal.toLowerCase().includes('wifi') || cleanedOriginal.toLowerCase().includes('wi-fi')) {
      wifiRestored++;
      restoredList.push(`- DB: "${dbMb.name}" (ID: ${dbMb.id}) -> Restored Curated: "${originalCuratedName}" -> Cleaned: "${cleanedOriginal}"`);
    }
  } else {
    console.log(`⚠️  Could not match: [${dbMb.brand}] "${dbMb.name}"`);
  }
}

console.log(`\nMatched: ${matchedCount} / ${dbMbs.length}`);
console.log(`WiFi motherboards detected for restore: ${wifiRestored}`);
console.log('\nSample restored WiFi boards:');
console.log(restoredList.slice(0, 30).join('\n'));

process.exit(0);
