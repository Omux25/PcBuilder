import { getSql } from './apps/backend/dist/core/db/index.js';

async function run() {
  await fetch('https://pcbuilder-m2nf.onrender.com/api/components');
  
  // Wait 12 seconds for the queue to flush
  console.log("Waiting 12 seconds for flush...");
  await new Promise(r => setTimeout(r, 12000));
  
  const sql = getSql();
  const rows = await sql`SELECT method, path, status_code, created_at FROM traffic_logs ORDER BY created_at DESC LIMIT 10`;
  console.log(rows);
  process.exit(0);
}
run().catch(console.error);
