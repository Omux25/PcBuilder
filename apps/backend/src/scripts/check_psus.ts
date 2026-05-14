
import { getSql } from '../core/db/index.js';

async function checkPsus() {
  const sql = getSql();
  
  const results = await sql`
    SELECT id, name, brand, category
    FROM components
    WHERE (name ~* '(\\d+W|Watt|80\\+|Alimentation|Power Supply)' OR category = 'psu')
    AND brand IN ('SG', 'XTRMLAB', 'XTMLAB', 'Setup Game')
    ORDER BY category, brand, name;
  ` as any[];

  console.log(`Found ${results.length} PSU-like components for targeted brands:`);
  results.forEach(r => {
    console.log(`[${r.category.padEnd(12)}] ${r.brand.padEnd(12)} | ${r.name} (ID: ${r.id})`);
  });
}

checkPsus().catch(console.error);
