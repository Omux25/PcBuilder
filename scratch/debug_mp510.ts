import { getSql } from '../apps/backend/src/core/db/index.js';

async function debugMp510() {
  const sql = getSql();
  console.log('--- Checking components with name like MP510 ---');
  const comps = await sql`
    SELECT id, name, brand, category, capacity_gb, interface_type, slug, is_active 
    FROM components 
    WHERE name ILIKE '%MP510%' OR name ILIKE '%Corsair Mp%'
  `;
  console.log('Components:', comps);

  for (const c of comps) {
    console.log(`\nMappings for Component ID ${c.id}:`);
    const mappings = await sql`
      SELECT sm.id, sm.product_url, sm.product_identifier, p.price, sm.retailer_id
      FROM scraper_mappings sm
      LEFT JOIN prices p ON p.product_url = sm.product_url AND p.component_id = sm.component_id
      WHERE sm.component_id = ${c.id}
    `;
    console.log(mappings);
  }
}

debugMp510().catch(console.error);
