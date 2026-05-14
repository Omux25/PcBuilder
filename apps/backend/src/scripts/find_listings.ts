
import { getSql } from '../core/db/index.js';

async function findListings() {
  const sql = getSql();
  
  const listings = await sql`
    SELECT id, scraped_name, status, linked_component_id 
    FROM unmatched_listings
    WHERE scraped_name ILIKE '%550W%80%PLUS%BRONZE%' OR scraped_name ILIKE '%750W%80%PLUS%BRONZE%'
  ` as any[];

  console.log(`--- MATCHING LISTINGS (${listings.length}) ---`);
  listings.forEach(l => {
    console.log(`- [${l.id}] ${l.scraped_name} (Status: ${l.status}, Linked: ${l.linked_component_id})`);
  });
}

findListings().catch(console.error);
