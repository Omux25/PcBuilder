import { getSql } from '../apps/backend/src/core/db/index';

async function run() {
  const sql = getSql();
  const res = await sql`
    SELECT
      us.category,
      COUNT(DISTINCT COALESCE(us.canonical_name, ul.scraped_name))::int AS group_count,
      COUNT(DISTINCT CASE
        WHEN us.confidence = 'high' AND us.existing_component_id IS NOT NULL
        THEN COALESCE(us.canonical_name, ul.scraped_name)
      END)::int AS high_confidence_linkable_count
    FROM unmatched_listings ul
    LEFT JOIN unmatched_suggestions us ON us.unmatched_listing_id = ul.id
    WHERE ul.status = 'pending'
    GROUP BY us.category
    ORDER BY us.category ASC NULLS LAST
  `;
  console.log("Category summary from DB:");
  console.log(JSON.stringify(res, null, 2));
}

run().catch(console.error);
