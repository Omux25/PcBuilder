
import { getSql } from '../core/db/index.js';

async function checkLingeringPollution() {
  const sql = getSql();

  const cases = await sql`
    SELECT id, name, brand, category
    FROM components
    WHERE category = 'case' 
      AND brand IN ('Hybrok', 'SG', 'Cougar', 'Setup Game')
    ORDER BY brand, name;
  ` as any[];

  console.log(`--- LINGERING POLLUTION IN 'CASE' (${cases.length}) ---`);
  cases.forEach(c => {
    console.log(`- [${c.id}] ${c.brand} | ${c.name}`);
  });
}

checkLingeringPollution().catch(console.error);
