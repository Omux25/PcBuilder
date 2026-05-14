// apps/backend/scripts/fix_miscategorized.ts
import { getSql } from '../src/core/db/index.js';
import { inferCategory, inferCategoryFromUrl, getCategoryPriority, extractBrand } from '@shared/component-utils';
import { deriveCanonicalName } from '../src/modules/scraping/services/suggestionEngine.js';
import { logger } from '../src/modules/scraping/engine/utils/logger.js';

function resolveCategory(name: string, url?: string) {
  const catByName = inferCategory(name);
  const catByUrl = url ? inferCategoryFromUrl(url) : null;

  if (!catByName && !catByUrl) return null;
  if (!catByName) return catByUrl;
  if (!catByUrl) return catByName;

  return getCategoryPriority(catByName as any) >= getCategoryPriority(catByUrl as any) ? catByName : catByUrl;
}

async function main() {
  const sql = getSql();
  console.log('🚀 Starting system-wide category fix (Priority System)...');

  // 1. Audit catalog mappings
  const mappings = (await sql`
    SELECT sm.id, sm.retailer_id, sm.product_url, sm.product_identifier, c.id as component_id, c.name, c.category as current_category
    FROM scraper_mappings sm
    JOIN components c ON c.id = sm.component_id
    WHERE c.is_active = true
  `) as { id: number; retailer_id: number; product_url: string; product_identifier: string; component_id: number; name: string; current_category: string }[];

  console.log(`Checking ${mappings.length} mappings...`);
  
  let fixedCount = 0;
  const componentsToMove = new Map<number, string>(); // id -> new category

  for (const m of mappings) {
    const suggested = resolveCategory(m.product_identifier || m.name, m.product_url);

    if (suggested && suggested !== m.current_category) {
      componentsToMove.set(m.component_id, suggested);
    }
  }

  if (componentsToMove.size === 0) {
    console.log('✅ No miscategorized components found.');
  } else {
    console.log(`🛠 Found ${componentsToMove.size} components to recategorize. Fixing...`);
    
    await sql.begin(async (tx) => {
      for (const [id, newCategory] of componentsToMove.entries()) {
        await tx`
          UPDATE components 
          SET category = ${newCategory}, updated_at = NOW() 
          WHERE id = ${id}
        `;
        fixedCount++;
      }
    });
    console.log(`✅ Successfully updated ${fixedCount} components.`);
  }

  // 2. Also re-run suggestions for unmatched listings
  console.log('🔍 Refreshing suggestions for unmatched listings...');
  const unmatched = (await sql`
    SELECT ul.id, ul.scraped_name, ul.product_url
    FROM unmatched_listings ul
    WHERE ul.status = 'pending'
  `) as { id: number; scraped_name: string; product_url: string }[];

  let suggestionsUpdated = 0;
  for (const item of unmatched) {
    const resolved = resolveCategory(item.scraped_name, item.product_url);

    if (resolved) {
      const brand = extractBrand(item.scraped_name);
      const canonicalName = deriveCanonicalName(item.scraped_name, brand);

      await sql`
        INSERT INTO unmatched_suggestions (unmatched_listing_id, category, confidence, canonical_name, brand, computed_at)
        VALUES (${item.id}, ${resolved}, 'high', ${canonicalName}, ${brand}, NOW())
        ON CONFLICT (unmatched_listing_id) DO UPDATE SET
          category = EXCLUDED.category,
          confidence = EXCLUDED.confidence,
          canonical_name = EXCLUDED.canonical_name,
          brand = EXCLUDED.brand,
          computed_at = NOW()
      `;
      suggestionsUpdated++;
    }
  }
  console.log(`✅ Updated ${suggestionsUpdated} unmatched suggestions.`);

  process.exit(0);
}

main().catch(err => {
  console.error('❌ Fix failed:', err);
  process.exit(1);
});
