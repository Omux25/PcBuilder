import { getSql } from './src/core/db/index.js';
const sql = getSql();
async function run() {
  const rows = await sql`SELECT DISTINCT chipset FROM components WHERE category = 'gpu' AND chipset IS NOT NULL ORDER BY chipset ASC`;
  console.log('GPU chipsets:', rows.map(r => r.chipset));
  process.exit(0);
}
run();
