
import { getSql } from '../core/db/index.js';

async function checkIds() {
  const sql = getSql();
  const res = await sql`
    SELECT id, name, brand, category 
    FROM components 
    WHERE id IN (5534, 5303)
  `;
  console.log(res);
}

checkIds().catch(console.error);
