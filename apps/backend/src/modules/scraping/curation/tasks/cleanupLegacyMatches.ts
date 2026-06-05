import type { SqlFn } from '../../../../core/db/index.js';
import type { TaskResult } from '../curationEngine.js';
import { calculateStrictScore, type CatalogComponent } from '../../../../core/utils/hardwareMatcher.js';

export async function cleanupLegacyMatches(sql: SqlFn): Promise<TaskResult> {
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

  let purgedCount = 0;

  for (const m of mappings) {
    try {
      const catalogComp: CatalogComponent = {
        id: m.component_id,
        name: m.component_name,
        brand: m.component_brand,
        category: m.component_category
      };

      const score = calculateStrictScore(m.scraped_name, catalogComp);

      if (score.total < 95) {
        await sql.begin(async (tx) => {
          await tx`
            DELETE FROM scraper_mappings 
            WHERE retailer_id = ${m.retailer_id} AND product_url = ${m.product_url}
          `;

          await tx`
            DELETE FROM prices 
            WHERE component_id = ${m.component_id} AND retailer_id = ${m.retailer_id} AND product_url = ${m.product_url}
          `;
        });

        purgedCount++;
      }
    } catch {
      // Ignore individually failing mappings and continue
    }
  }

  return {
    success: true,
    mutatedCount: purgedCount,
    message: `Purged ${purgedCount} low-confidence mappings and price records (<95% match).`
  };
}
