
import { getSql } from '../core/db/index.js';

async function checkFinalSg() {
  const sql = getSql();
  const res = await sql`
    SELECT id, name, brand, category 
    FROM components 
    WHERE brand = 'SG' OR name ILIKE 'Sg %' OR name = 'Sg'
  `;
  console.log(res);
}

checkFinalSg().catch(console.error);
