
import { getSql } from '../core/db/index.js';

async function finalCaseCheck() {
  const sql = getSql();
  console.log('--- FINAL CASE CATEGORY AUDIT ---');

  const cases = await sql`
    SELECT id, name, brand, category
    FROM components
    WHERE category = 'case'
    ORDER BY brand, name;
  ` as any[];

  console.log(`Found ${cases.length} components in 'case':`);
  cases.forEach(c => {
    console.log(`- [${c.id}] ${c.brand} | ${c.name}`);
  });
}

finalCaseCheck().catch(console.error);
