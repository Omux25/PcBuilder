
import { getSql } from '../core/db/index.js';

async function checkSg() {
  const sql = getSql();
  const psus = await sql`SELECT id, name, brand, category, wattage FROM components WHERE brand = 'SG' OR brand = 'Setup Game'`;
  console.log(psus);
}

checkSg().catch(console.error);
