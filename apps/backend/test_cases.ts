import { getSql } from './src/core/db/index.js';
async function run() {
  const sql = getSql();
  const rows = await sql`
    SELECT count(*) as count
    FROM components 
    WHERE category = 'case' 
      AND (max_cooler_height_mm IS NULL OR supported_motherboards IS NULL)
  `;
  console.log(rows);
  process.exit(0);
}
run();
