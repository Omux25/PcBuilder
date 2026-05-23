import { getSql } from '../apps/backend/src/core/db/index.js';

const sql = getSql();

async function run() {
  const listings = await sql`
    SELECT * 
    FROM unmatched_listings 
    LIMIT 10
  `;
  console.log(listings);
}

run().then(() => process.exit(0));
