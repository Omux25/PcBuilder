import { getSql } from './src/core/db/index.js';
const sql = getSql();
async function run() {
  const rows = await sql`SELECT name, brand FROM components WHERE category = 'psu' AND brand = 'Aerocool' ORDER BY name ASC`;
  console.log('Aerocool products:', rows);
  process.exit(0);
}
run();
