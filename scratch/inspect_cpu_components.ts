import { getSql } from '../apps/backend/src/core/db/index';

async function run() {
  const sql = getSql();
  
  // Get samples of CPU components
  const cpus = await sql`
    SELECT id, name, brand, category, slug, socket, core_count, thread_count
    FROM components
    WHERE category = 'cpu'
    LIMIT 20
  `;
  console.log("=== CPU Component Samples ===");
  console.log(JSON.stringify(cpus, null, 2));
}

run().catch(console.error).then(() => process.exit(0));
