import { getSql } from '../apps/backend/src/core/db/index.js';

const sql = getSql();

async function run() {
  const coolingDefaults = await sql`
    SELECT COUNT(*) as count 
    FROM components 
    WHERE category = 'cooling' 
      AND max_tdp = 200
  ` as any[];

  const allCooling = await sql`
    SELECT COUNT(*) as count 
    FROM components 
    WHERE category = 'cooling'
  ` as any[];

  const gpuDefaults = await sql`
    SELECT COUNT(*) as count 
    FROM components 
    WHERE category = 'gpu' 
      AND length_mm = 280
  ` as any[];

  const allGpu = await sql`
    SELECT COUNT(*) as count 
    FROM components 
    WHERE category = 'gpu'
  ` as any[];

  console.log(`Total Coolers in Catalog: ${allCooling[0].count}`);
  console.log(`Coolers with Heuristic Default (200W TDP): ${coolingDefaults[0].count}`);
  console.log(`Total GPUs in Catalog: ${allGpu[0].count}`);
  console.log(`GPUs with Heuristic Default (280mm Length): ${gpuDefaults[0].count}`);
}

run().then(() => process.exit(0));
