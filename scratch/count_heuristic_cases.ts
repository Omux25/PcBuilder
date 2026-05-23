import { getSql } from '../apps/backend/src/core/db/index.js';

const sql = getSql();

async function run() {
  const defaults = await sql`
    SELECT COUNT(*) as count 
    FROM components 
    WHERE category = 'case' 
      AND max_gpu_length_mm = 330 
      AND max_cooler_height_mm = 160
  ` as any[];

  const allCases = await sql`
    SELECT COUNT(*) as count 
    FROM components 
    WHERE category = 'case'
  ` as any[];

  console.log(`Total Cases in Catalog: ${allCases[0].count}`);
  console.log(`Cases with Heuristic Defaults (330/160): ${defaults[0].count}`);
}

run().then(() => process.exit(0));
