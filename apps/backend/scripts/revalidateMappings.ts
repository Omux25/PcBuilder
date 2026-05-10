// apps/backend/scripts/revalidateMappings.ts
import { getSql } from '../src/db/index';
import { scoreDnaMatch } from '../src/utils/componentMatcher';

async function revalidate() {
  const sql = getSql();
  
  // It appears 'product_identifier' in scraper_mappings is used to store the product name
  const mappings = await sql`
    SELECT sm.id, sm.component_id, sm.product_identifier as scraped_name, sm.product_url, sm.retailer_id,
           c.category, c.name as component_name
    FROM scraper_mappings sm
    JOIN components c ON c.id = sm.component_id
  `;

  console.log(`Revalidating ${mappings.length} mappings...`);
  let deletedCount = 0;

  for (const m of mappings) {
    if (!m.scraped_name) continue;

    const score = scoreDnaMatch(m.scraped_name, m.component_name, m.category);
    
    // We require a perfect DNA match (score 1.0). 
    // If some DNA tokens from the catalog are missing in the product name, it's a mismatch.
    if (score.score < 1.0) {
      console.log(`[INVALID] "${m.scraped_name}" no longer matches "${m.component_name}" (${m.category}). Score: ${score.score}`);
      
      // 1. Remove the mapping
      await sql`DELETE FROM scraper_mappings WHERE id = ${m.id}`;
      
      // 2. Remove corresponding price entries
      await sql`DELETE FROM prices WHERE retailer_id = ${m.retailer_id} AND product_url = ${m.product_url}`;
      
      // 3. If there is a corresponding entry in unmatched_listings, reset it to pending
      await sql`
        UPDATE unmatched_listings 
        SET status = 'pending', linked_component_id = NULL 
        WHERE retailer_id = ${m.retailer_id} AND product_url = ${m.product_url}
      `;
      
      deletedCount++;
    }
  }

  console.log(`Done! Removed ${deletedCount} invalid mappings.`);
  process.exit(0);
}

revalidate().catch(err => {
  console.error(err);
  process.exit(1);
});
