import { getSql } from '../apps/backend/src/core/db/index.js';

const sql = getSql();

async function run() {
  const categories = await sql`
    SELECT category, count(*) 
    FROM components 
    GROUP BY category
  `;
  console.log(categories);
}

run().then(() => process.exit(0));
