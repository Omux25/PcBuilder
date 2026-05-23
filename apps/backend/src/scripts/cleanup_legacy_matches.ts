/**
 * cleanup_legacy_matches.ts — Database Sanitation Script.
 * 
 * Purges legacy false-positive matches by re-evaluating all existing
 * scraper mappings using the new strict HardwareMatcher engine.
 * 
 * Process:
 * 1. Fetch all scraper_mappings joined with component info.
 * 2. For each mapping, calculate the strict matching score.
 * 3. If score < 95%, DELETE the mapping and its corresponding price record.
 */

import { getSql } from '../core/db/index.js';
import { calculateStrictScore, type CatalogComponent } from '../core/utils/hardwareMatcher.js';
import { logger } from '../modules/scraping/engine/utils/logger.js';

async function runCleanup() {
  const sql = getSql();
  console.log('[CLEANUP] Starting legacy match sanitation...');
  await logger.info('[CLEANUP] Starting legacy match sanitation...');

  // 1. Fetch all linked mappings
  const mappings = (await sql`
    SELECT 
      sm.retailer_id, 
      sm.product_url, 
      sm.product_identifier as scraped_name,
      sm.component_id,
      c.name as component_name,
      c.brand as component_brand,
      c.category as component_category
    FROM scraper_mappings sm
    JOIN components c ON c.id = sm.component_id
  `) as any[];

  console.log(`[CLEANUP] Found ${mappings.length} mappings to re-evaluate.`);
  await logger.info(`[CLEANUP] Found ${mappings.length} mappings to re-evaluate.`);

  let purgedCount = 0;
  let errorCount = 0;
  let i = 0;

  for (const m of mappings) {
    if (i % 100 === 0) console.log(`[CLEANUP] Processed ${i}/${mappings.length}...`);
    i++;
    try {
      const catalogComp: CatalogComponent = {
        id: m.component_id,
        name: m.component_name,
        brand: m.component_brand,
        category: m.component_category
      };

      const score = calculateStrictScore(m.scraped_name, catalogComp);

      if (i < 10) {
        console.log(`[DEBUG] Offer: "${m.scraped_name}" | Master: "${m.component_brand} ${m.component_name}" | Score: ${score.total}% | Reason: ${score.rejectionReason || 'None'}`);
      }

      if (score.total < 95) {
        console.log(`[CLEANUP] Purging bad match: "${m.scraped_name}" linked to "${m.component_brand} ${m.component_name}" (Score: ${score.total}%, Reason: ${score.rejectionReason || 'Low confidence'})`);

        // Transactional delete to ensure consistency
        await sql.begin(async (tx) => {
          // Delete from scraper_mappings
          await tx`
            DELETE FROM scraper_mappings 
            WHERE retailer_id = ${m.retailer_id} AND product_url = ${m.product_url}
          `;

          // Delete current price for this specific offer/link
          await tx`
            DELETE FROM prices 
            WHERE component_id = ${m.component_id} AND retailer_id = ${m.retailer_id} AND product_url = ${m.product_url}
          `;
          
          // Price history is kept for data integrity, but the link is severed.
        });

        purgedCount++;
      }
    } catch (err) {
      errorCount++;
      await logger.error(`[CLEANUP] Error evaluating mapping ${m.product_url}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  await logger.info(`[CLEANUP] Sanitation complete.`);
  await logger.info(`[CLEANUP] Summary: ${purgedCount} bad matches purged, ${mappings.length - purgedCount - errorCount} valid matches kept, ${errorCount} errors.`);
  
  process.exit(0);
}

runCleanup().catch(err => {
  console.error(err);
  process.exit(1);
});
