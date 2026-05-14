
import { getSql } from '../core/db/index.js';

async function checkSgListings() {
  const sql = getSql();
  
  const listings = await sql`
    SELECT id, scraped_name, status, linked_component_id 
    FROM unmatched_listings
    WHERE scraped_name ILIKE '%SG %' OR scraped_name ILIKE '%Setup Game%'
  ` as any[];

  console.log(`--- SETUP GAME / SG LISTINGS (${listings.length}) ---`);
  listings.forEach(l => {
    if (l.scraped_name.includes('550W') || l.scraped_name.includes('750W')) {
        console.log(`- [${l.id}] ${l.scraped_name} (Status: ${l.status}, Linked: ${l.linked_component_id})`);
    }
  });
}

checkSgListings().catch(console.error);
