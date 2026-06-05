import { getSql } from '../apps/backend/src/core/db/index';

async function run() {
  const sql = getSql();
  
  const statusCounts = await sql`
    SELECT status, COUNT(*)::int AS cnt
    FROM unmatched_listings
    GROUP BY status
  `;
  console.log("=== Listing Statuses ===");
  console.log(statusCounts);
  
  const categoryCounts = await sql`
    SELECT us.category, COUNT(*)::int AS cnt
    FROM unmatched_listings ul
    LEFT JOIN unmatched_suggestions us ON us.unmatched_listing_id = ul.id
    GROUP BY us.category
  `;
  console.log("=== Category Counts ===");
  console.log(categoryCounts);
}

run().catch(console.error).then(() => process.exit(0));
