// apps/backend/scripts/debug_unmatched.ts
import { getSql } from '../src/core/db/index.js';

async function main() {
  const sql = getSql();
  console.log('--- Unmatched Listings Summary ---');
  
  const count = await sql`SELECT COUNT(*) FROM unmatched_listings WHERE status = 'pending'`;
  console.log('Pending unmatched listings:', count[0].count);

  const sugCount = await sql`SELECT COUNT(*) FROM unmatched_suggestions`;
  console.log('Unmatched suggestions:', sugCount[0].count);

  const summary = await sql`
    SELECT
      us.category,
      COUNT(*)::int AS listing_count,
      COUNT(DISTINCT COALESCE(us.canonical_name, ul.scraped_name))::int AS group_count
    FROM unmatched_listings ul
    LEFT JOIN unmatched_suggestions us ON us.unmatched_listing_id = ul.id
    WHERE ul.status = 'pending'
    GROUP BY us.category
  `;
  console.log('\nCategory Summary (Internal Logic):');
  console.table(summary);

  const categories = await sql`SELECT id, name FROM categories`;
  console.log('\nCategories in DB:', categories.map(c => c.name).join(', '));

  process.exit(0);
}

main();
