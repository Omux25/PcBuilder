
import { getSql } from '../core/db/index.js';

async function checkBrands() {
  const sql = getSql();
  const brands = ['SG', 'XTRMLAB', 'XTMLAB', 'Setup Game'];
  
  // In Bun.sql, passing an array to a parameter that is used with IN should work
  const results = await sql`
    SELECT category, brand, name, id
    FROM components
    WHERE brand IN (${brands[0]}, ${brands[1]}, ${brands[2]}, ${brands[3]})
    ORDER BY category, brand, name;
  ` as any[];

  console.log(`Found ${results.length} components for targeted brands:`);
  results.forEach(r => {
    console.log(`[${r.category.padEnd(12)}] ${r.brand.padEnd(12)} | ${r.name} (ID: ${r.id})`);
  });
}

checkBrands().catch(console.error);
