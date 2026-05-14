
import { getSql } from '../core/db/index.js';

async function checkCasesForWattage() {
  const sql = getSql();
  
  const results = await sql`
    SELECT id, name, brand, category
    FROM components
    WHERE category = 'case'
    AND name ~* '([456789]00|550|650|750|850|1000|1200|1500)'
    ORDER BY brand, name;
  ` as any[];

  console.log(`Found ${results.length} components with potential wattage/size in 'case' category:`);
  results.forEach(r => {
    console.log(`- [${r.id}] Brand: ${r.brand} | Name: ${r.name}`);
  });
}

checkCasesForWattage().catch(console.error);
