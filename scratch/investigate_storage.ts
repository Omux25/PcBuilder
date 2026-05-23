import { getSql } from '../apps/backend/src/core/db/index.js';

async function investigate() {
  const sql = getSql();
  
  console.log('--- Checking storage components with suspicious capacities (> 4000 GB, i.e., > 4TB) ---');
  const largeStorage = await sql`
    SELECT id, name, brand, capacity_gb, interface_type, slug, is_active
    FROM components
    WHERE category = 'storage' AND capacity_gb > 8000
    ORDER BY capacity_gb DESC
  `;
  console.log(`Found ${largeStorage.length} suspicious large storage components:`);
  console.log(largeStorage);

  console.log('\n--- Checking storage components with high price variance (> 1.5 ratio) ---');
  const priceVariance = await sql`
    SELECT 
      c.id,
      c.name,
      c.brand,
      c.capacity_gb,
      min(p.price) as min_price,
      max(p.price) as max_price,
      (max(p.price) / NULLIF(min(p.price), 0))::numeric(10,2) as price_ratio,
      count(*) as listing_count
    FROM prices p
    JOIN components c ON c.id = p.component_id
    WHERE c.category = 'storage' AND c.is_active = true
    GROUP BY c.id, c.name, c.brand, c.capacity_gb
    HAVING (max(p.price) / NULLIF(min(p.price), 0)) > 1.5
    ORDER BY price_ratio DESC
  `;
  console.log(`Found ${priceVariance.length} storage components with high price ratio:`);
  console.log(priceVariance);
}

investigate().catch(console.error);
