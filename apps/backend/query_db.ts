import { config } from 'dotenv';
config({ path: '.env' });
import { getSql } from './src/core/db/index.js';
async function run() {
  const sql = getSql();
  const res = await sql`SELECT * FROM traffic_logs ORDER BY created_at DESC LIMIT 5`;
  console.log(res);
  process.exit(0);
}
run();
