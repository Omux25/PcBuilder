
import { getSql } from '../core/db/index.js';

async function checkPending() {
  const sql = getSql();
  const res = await sql`
    SELECT id, scraped_name, product_url, status, linked_component_id 
    FROM unmatched_listings 
    WHERE product_url ILIKE '%alimentation-sg%'
  `;
  console.log(res);
}

checkPending().catch(console.error);
