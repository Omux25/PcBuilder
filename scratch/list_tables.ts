import { getSql } from '../apps/backend/src/core/db/index.js';

const sql = getSql();

async function run() {
  const tables = await sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
  `;
  console.log(tables);
}

run().then(() => process.exit(0));
