import { getSql } from '../apps/backend/src/core/db/index.js';

const sql = getSql();

async function run() {
  const results = await sql`
    SELECT id, name, category, brand 
    FROM components 
    WHERE name ~* 'v750|v650|bronze'
  `;
  console.log(results);
}

run().then(() => process.exit(0));
