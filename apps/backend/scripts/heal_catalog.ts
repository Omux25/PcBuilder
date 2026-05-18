// apps/backend/scripts/heal_catalog.ts
import { getSql } from '../src/core/db/index.js';
import { inferCategory, inferCategoryFromUrl, getCategoryPriority } from '@shared/hardware/categories';
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
  console.log('🚀 Starting Catalog Healing (Mapping Discrepancy Fix)...');

  // 1. Identify mappings that don't match their component's category
  const mappings = (await sql`
    SELECT sm.id, sm.product_url, sm.product_identifier, c.id as component_id, c.name, c.category as component_category
    FROM scraper_mappings sm
    JOIN components c ON c.id = sm.component_id
    WHERE c.is_active = true
  `) as { id: number; product_url: string; product_identifier: string; component_id: number; name: string; component_category: string }[];

  console.log(`Analyzing ${mappings.length} mappings...`);
  
  const toUnlink: number[] = [];
  const componentStats = new Map<number, { correct: number, incorrect: number, suggested: string | null }>();

  for (const m of mappings) {
    const suggested = resolveCategory(m.product_identifier || m.name, m.product_url);
    
    const stats = componentStats.get(m.component_id) || { correct: 0, incorrect: 0, suggested: null };
    
    if (suggested === m.component_category) {
      stats.correct++;
    } else if (suggested) {
      stats.incorrect++;
      // If a mapping is CLEARLY wrong (e.g. PSU mapping on a Case component)
      if (getCategoryPriority(suggested as any) >= 2 || getCategoryPriority(m.component_category as any) >= 2) {
         // High confidence discrepancy: prioritize unlinking
         toUnlink.push(m.id);
      }
    }
    componentStats.set(m.component_id, stats);
  }

  if (toUnlink.length === 0) {
    console.log('✅ No major mapping discrepancies found.');
  } else {
    console.log(`🛠 Found ${toUnlink.length} inconsistent mappings. Unlinking...`);
    
    await sql.begin(async (tx) => {
      // Instead of just deleting, we should probably move them to unmatched_listings 
      // so they can be re-processed correctly.
      
      // Get details for unmatched_listings before deleting
      const details = (await tx`
        SELECT sm.retailer_id, sm.product_url, sm.product_identifier, p.price
        FROM scraper_mappings sm
        LEFT JOIN prices p ON p.product_url = sm.product_url AND p.retailer_id = sm.retailer_id
        WHERE sm.id IN ${tx(toUnlink)}
      `) as { retailer_id: number; product_url: string; product_identifier: string; price: number | null }[];

      for (const d of details) {
        await tx`
          INSERT INTO unmatched_listings (retailer_id, product_url, scraped_name, scraped_price, image_url, status)
          VALUES (${d.retailer_id}, ${d.product_url}, ${d.product_identifier}, ${d.price || 0}, NULL, 'pending')
          ON CONFLICT (retailer_id, product_url) DO UPDATE SET status = 'pending'
        `;
      }


      await tx`DELETE FROM scraper_mappings WHERE id IN ${tx(toUnlink)}`;
      // Also delete price for this specific mapping to avoid ghost prices
      // Note: This is a bit tricky as prices table doesn't have mapping_id.
      // But we have product_url and retailer_id.
      for (const d of details) {
        await tx`DELETE FROM prices WHERE product_url = ${d.product_url} AND retailer_id = ${d.retailer_id}`;
      }
    });
    console.log(`✅ Successfully unlinked ${toUnlink.length} mappings and queued for reprocessing.`);
  }

  // 2. Clean up "Zombie" components (no mappings left)
  console.log('🔍 Cleaning up orphan components...');
  const orphans = (await sql`
    SELECT c.id, c.name FROM components c
    LEFT JOIN scraper_mappings sm ON sm.component_id = c.id
    WHERE sm.id IS NULL AND c.is_active = true
  `) as any[];

  if (orphans.length > 0) {
    console.log(`🗑 Found ${orphans.length} orphan components. Deleting...`);
    await sql`DELETE FROM components WHERE id IN ${sql(orphans.map((o: any) => o.id))}`;
    console.log(`✅ Deleted ${orphans.length} orphans.`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error('❌ Healing failed:', err);
  process.exit(1);
});
