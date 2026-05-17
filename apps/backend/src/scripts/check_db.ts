
import { getSql } from '../core/db/index.js';

async function checkDb() {
  const sql = getSql();
  const psus = (await sql`SELECT id, name, brand, category, wattage FROM components WHERE name ILIKE '%750W%'`) as { brand: string }[];
  console.log('All 750W components:', psus.filter(p => p.brand === 'SG' || p.brand === 'Setup Game'));
}

checkDb().catch(console.error);
