
import { getSql } from '../core/db/index.js';

async function checkCasesForPsus() {
  const sql = getSql();
  
  const results = await sql`
    SELECT id, name, brand, category
    FROM components
    WHERE category = 'case'
    AND name ~* '(\\d+W|Watt|80\\+|Alimentation|Power Supply|Modular|Certified)'
    ORDER BY brand, name;
  ` as any[];

  console.log(`Found ${results.length} PSU-like components in 'case' category:`);
  results.forEach(r => {
    console.log(`- [${r.id}] Brand: ${r.brand} | Name: ${r.name}`);
  });
}

checkCasesForPsus().catch(console.error);
