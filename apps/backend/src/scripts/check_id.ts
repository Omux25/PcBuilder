
import { getSql } from '../core/db/index.js';

async function checkId() {
  const sql = getSql();
  const id = 3636;
  const res = await sql`SELECT name, brand, category FROM components WHERE id = ${id}`;
  console.log(res[0]);
}

checkId().catch(console.error);
