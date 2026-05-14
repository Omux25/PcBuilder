
import { getSql } from '../core/db/index.js';

async function checkMappings() {
  const sql = getSql();
  const res = await sql`
    SELECT sm.component_id, c.name, c.brand, c.category, sm.product_identifier, sm.product_url
    FROM scraper_mappings sm
    JOIN components c ON c.id = sm.component_id
    WHERE sm.product_url ILIKE '%alimentation-sg%'
  `;
  console.log(res);
}

checkMappings().catch(console.error);
