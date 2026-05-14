
import { getSql } from '../core/db/index.js';

async function finalCheck() {
  const sql = getSql();
  const results = await sql`
    SELECT id, name, brand, category
    FROM components
    WHERE brand IN ('SG', 'XTRMLAB', 'XTMLAB', 'Setup Game')
    AND category = 'case'
    ORDER BY name;
  ` as any[];

  console.log(`--- XTRMLAB/SG IN CASE CATEGORY (${results.length}) ---`);
  results.forEach(r => {
    console.log(`- [${r.id}] ${r.name}`);
  });
}

finalCheck().catch(console.error);
