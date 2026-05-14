// apps/backend/scripts/merge_zombies.ts
import { getSql } from '../src/core/db/index.js';
import { scoreDnaMatch, extractDna } from '../src/core/utils/componentMatcher.js';
import { getCategoryPriority } from '../../../shared/hardware/categories.js';
import { logger } from '../src/modules/scraping/engine/utils/logger.js';

async function main() {
  const sql = getSql();
  console.log('🚀 Starting Zombie Component Merger...');

  // 1. Load all components with mapping counts
  const components = await sql`
    SELECT c.id, c.name, c.brand, c.category, COUNT(sm.id) as mapping_count
    FROM components c
    LEFT JOIN scraper_mappings sm ON sm.component_id = c.id
    GROUP BY c.id, c.name, c.brand, c.category
    ORDER BY c.id ASC
  `;

  console.log(`Analyzing ${components.length} components for duplicates...`);

  // Optimization: Group by first DNA token to avoid O(N^2)
  const dnaGroups: Map<string, any[]> = new Map();
  for (const c of components) {
    const dna = extractDna(c.brand ? `${c.brand} ${c.name}` : c.name, c.category);
    if (dna.length > 0) {
      const firstToken = dna[0];
      const list = dnaGroups.get(firstToken) || [];
      list.push({ ...c, dna });
      dnaGroups.set(firstToken, list);
    }
  }

  const groups: Map<string, any[]> = new Map();

  for (const [token, members] of dnaGroups.entries()) {
    if (members.length < 2) continue;

    const processedInGroup = new Set<number>();

    for (let i = 0; i < members.length; i++) {
      const c1 = members[i];
      if (processedInGroup.has(c1.id)) continue;

      const dupGroup = [c1];
      processedInGroup.add(c1.id);

      for (let j = i + 1; j < members.length; j++) {
        const c2 = members[j];
        if (processedInGroup.has(c2.id)) continue;

        // Compare within same DNA-token group
        const match1 = scoreDnaMatch(
          c1.brand ? `${c1.brand} ${c1.name}` : c1.name, 
          c2.brand ? `${c2.brand} ${c2.name}` : c2.name, 
          c2.category
        );
        const match2 = scoreDnaMatch(
          c2.brand ? `${c2.brand} ${c2.name}` : c2.name, 
          c1.brand ? `${c1.brand} ${c1.name}` : c1.name, 
          c1.category
        );

        if (match1.score >= 1.0 || match2.score >= 1.0) {
          dupGroup.push(c2);
          processedInGroup.add(c2.id);
        }
      }

      if (dupGroup.length > 1) {
        groups.set(`${token}-${c1.id}`, dupGroup);
      }
    }
  }

  console.log(`Found ${groups.size} groups of potential duplicates.`);

  let totalMerged = 0;
  let totalDeleted = 0;

  for (const [groupId, members] of groups.entries()) {
    // 2. Selection Logic
    const sorted = [...members].sort((a, b) => {
      const pA = getCategoryPriority(a.category);
      const pB = getCategoryPriority(b.category);

      // Priority 1: Category Priority (P3 > P2 > P1)
      if (pA !== pB) return pB - pA;

      // Priority 2: Mapping Count
      if (a.mapping_count !== b.mapping_count) return b.mapping_count - a.mapping_count;

      // Priority 3: Age (Lowest ID survives)
      return a.id - b.id;
    });

    const survivor = sorted[0];
    const zombies = sorted.slice(1);

    console.log(`\nGroup ${groupId}: Survived [${survivor.id}] ${survivor.name} (${survivor.category})`);
    
    await sql.begin(async (tx) => {
      for (const zombie of zombies) {
        console.log(`  - Merging zombie [${zombie.id}] ${zombie.name} (${zombie.category})`);
        
        // Migrate mappings
        const updatedMappings = await tx`
          UPDATE scraper_mappings 
          SET component_id = ${survivor.id} 
          WHERE component_id = ${zombie.id}
          RETURNING id
        `;
        
        // Migrate prices (handling conflicts by keeping existing prices on survivor or overwriting if zombie is newer)
        // For simplicity, we just delete prices for the zombie and let the mappings handle new prices, 
        // but it's better to update them.
        await tx`
          INSERT INTO prices (component_id, retailer_id, product_url, price, in_stock, last_updated)
          SELECT ${survivor.id}, retailer_id, product_url, price, in_stock, last_updated
          FROM prices WHERE component_id = ${zombie.id}
          ON CONFLICT (component_id, retailer_id, product_url) DO UPDATE SET
            price = EXCLUDED.price,
            in_stock = EXCLUDED.in_stock,
            last_updated = EXCLUDED.last_updated
        `;
        await tx`DELETE FROM prices WHERE component_id = ${zombie.id}`;

        // Migrate price history
        await tx`
          UPDATE price_history 
          SET component_id = ${survivor.id} 
          WHERE component_id = ${zombie.id}
        `;

        // Finally delete the zombie
        await tx`DELETE FROM components WHERE id = ${zombie.id}`;
        
        totalMerged += updatedMappings.length;
        totalDeleted++;
      }
    });
  }

  console.log(`\n✅ Done! Merged ${totalMerged} mappings and deleted ${totalDeleted} zombie components.`);
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error during merge:', err);
  process.exit(1);
});
