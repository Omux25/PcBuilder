import { getSql } from '../apps/backend/src/core/db/index';
import { deriveCanonicalName } from '../apps/backend/src/modules/scraping/services/suggestionEngine';

async function run() {
  const sql = getSql();
  
  // Fetch pending CPU listings
  const pending = await sql`
    SELECT ul.scraped_name, us.brand, us.category
    FROM unmatched_listings ul
    LEFT JOIN unmatched_suggestions us ON us.unmatched_listing_id = ul.id
    WHERE ul.status = 'pending' AND us.category = 'cpu'
  `;
  
  console.log(`Loaded ${pending.length} pending CPU listings.`);
  
  // Group them by our current production deriveCanonicalName
  const canonicalGroups = new Set<string>();
  const groupToListings = new Map<string, string[]>();
  
  for (const item of pending) {
    const canonical = deriveCanonicalName(item.scraped_name, item.brand, item.category);
    canonicalGroups.add(canonical);
    if (!groupToListings.has(canonical)) {
      groupToListings.set(canonical, []);
    }
    groupToListings.get(canonical)!.push(item.scraped_name);
  }
  
  console.log(`Current unique CPU groups: ${canonicalGroups.size}`);
  
  // Heuristic: Group the canonical names by their core model identifier (e.g. "12400F", "7800X3D", "5600G")
  const modelToGroups = new Map<string, string[]>();
  
  // List of known CPU model patterns
  // Matches things like 7800X3D, 12400F, 5600G, 9950X, 10105F, 245K, 5655G etc.
  const modelRegex = /\b(?:ryzen\s+[3579]\s+pro\s+|ryzen\s+[3579]\s+|core\s+ultra\s+[579]\s+|core\s+i[3579]\s+|ultra\s+[579]\s+)?(\d{4,5}[a-zA-Z]*|\d{3}[a-zA-Z]*)\b/i;

  for (const canonical of canonicalGroups) {
    const match = canonical.match(modelRegex);
    if (match) {
      const modelId = match[1].toUpperCase(); // The core model number like "12400F" or "7800X3D"
      // Skip very generic small numbers
      if (modelId.length < 3 || /^\d+$/.test(modelId) && parseInt(modelId) < 1000) continue;
      
      if (!modelToGroups.has(modelId)) {
        modelToGroups.set(modelId, []);
      }
      modelToGroups.get(modelId)!.push(canonical);
    }
  }
  
  console.log("\n--- Heuristic Audit: Finding duplicate groups for the same CPU model ---");
  let duplicatesFound = 0;
  
  for (const [modelId, groups] of modelToGroups.entries()) {
    if (groups.length > 1) {
      duplicatesFound++;
      console.log(`\nAnomaly Detected! CPU Model [${modelId}] is split across ${groups.length} distinct groups:`);
      groups.forEach((g) => {
        const listings = groupToListings.get(g) || [];
        console.log(`  -> Group: "${g}" (${listings.length} listings)`);
        console.log(`     Samples: ${listings.slice(0, 2).join(" | ")}`);
      });
    }
  }
  
  if (duplicatesFound === 0) {
    console.log("\n✅ Fantastic! No duplicate CPU groups detected using the model heuristic.");
  } else {
    console.log(`\nTotal CPU model anomalies found: ${duplicatesFound}`);
  }
}

run().catch(console.error);
