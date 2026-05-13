import { getSql } from './src/core/db/index.js';
const sql = getSql();
async function run() {
  const rows = await sql`SELECT name, brand FROM components WHERE category = 'psu' AND (LOWER(name) LIKE 'z%' OR LOWER(brand) LIKE 'z%')`;
  console.log('Z products:', rows);
  process.exit(0);
}
run();
