import { getSql } from '../apps/backend/src/core/db/index.js';

async function test() {
  const sql = getSql();
  
  // Count prices by component category
  const priceCount = await sql`
    SELECT c.category, COUNT(*)::int
    FROM prices p
    JOIN components c ON c.id = p.component_id
    GROUP BY c.category
  `;
  console.log('Prices by component category:', priceCount);

  // Count scraper_mappings by component category
  const mappingCount = await sql`
    SELECT c.category, COUNT(*)::int
    FROM scraper_mappings sm
    JOIN components c ON c.id = sm.component_id
    GROUP BY c.category
  `;
  console.log('Scraper mappings by component category:', mappingCount);

  process.exit(0);
}

test().catch(err => {
  console.error(err);
  process.exit(1);
});
