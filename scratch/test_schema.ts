import { getSql } from '../apps/backend/src/core/db/index.js';

async function test() {
  const sql = getSql();
  
  // Query table info for unmatched_listings
  const listingsInfo = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'unmatched_listings'
  `;
  console.log('unmatched_listings columns:', listingsInfo);
  
  // Query table info for unmatched_suggestions
  const suggestionsInfo = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'unmatched_suggestions'
  `;
  console.log('unmatched_suggestions columns:', suggestionsInfo);
  
  process.exit(0);
}

test().catch(err => {
  console.error(err);
  process.exit(1);
});
