import { getSql } from './dist/core/db/index.js';

async function run() {
  const sql = getSql();
  const rows = await sql`SELECT method, path, status_code, created_at FROM traffic_logs ORDER BY created_at DESC LIMIT 5`;
  console.log(rows);
  process.exit(0);
}
run().catch(console.error);
