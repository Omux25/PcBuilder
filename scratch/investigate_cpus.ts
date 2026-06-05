import { getSql } from '../apps/backend/src/core/db/index';

async function run() {
  const sql = getSql();
  
  console.log("=== Group Statistics ===");
  const breakdown = await sql`
    WITH group_counts AS (
      SELECT
        COALESCE(us.canonical_name, ul.scraped_name) AS canonical_name,
        COUNT(ul.id)::int AS listing_count
      FROM unmatched_listings ul
      LEFT JOIN unmatched_suggestions us ON us.unmatched_listing_id = ul.id
      WHERE ul.status = 'pending' AND us.category = 'cpu'
      GROUP BY COALESCE(us.canonical_name, ul.scraped_name)
    )
    SELECT
      listing_count,
      COUNT(*)::int AS number_of_groups
    FROM group_counts
    GROUP BY listing_count
    ORDER BY listing_count ASC
  `;
  
  console.log("Breakdown of groups by the number of listings they contain:");
  breakdown.forEach((row) => {
    console.log(`Groups with exactly ${row.listing_count} listing(s): ${row.number_of_groups}`);
  });

  const totalListings = await sql`
    SELECT COUNT(*)::int AS cnt
    FROM unmatched_listings ul
    LEFT JOIN unmatched_suggestions us ON us.unmatched_listing_id = ul.id
    WHERE ul.status = 'pending' AND us.category = 'cpu'
  `;
  console.log(`\nTotal unmatched CPU listings in DB: ${totalListings[0].cnt}`);
}

run().catch(console.error);
