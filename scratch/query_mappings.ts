import { getSql } from '../apps/backend/src/core/db/index.js';

async function query() {
  const sql = getSql();
  const suspiciousComps = await sql`
    SELECT id, name, capacity_gb 
    FROM components 
    WHERE category = 'storage' AND capacity_gb > 8000
    LIMIT 10
  `;

  for (const c of suspiciousComps) {
    console.log(`\nComponent ID ${c.id}: "${c.name}" (Capacity GB in DB: ${c.capacity_gb})`);
    const mappings = await sql`
      SELECT product_identifier 
      FROM scraper_mappings 
      WHERE component_id = ${c.id}
    `;
    console.log('Mappings:', mappings.map(m => m.product_identifier));
  }
}

query().catch(console.error);
