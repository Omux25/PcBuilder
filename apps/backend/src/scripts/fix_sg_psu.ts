
import { getSql } from '../core/db/index.js';

async function fixSgPsu() {
  const sql = getSql();
  console.log('--- FIXING "Sg" COMPONENT (ID 3615) ---');

  // 1. Move the mappings back to pending
  await sql`
    UPDATE unmatched_listings
    SET status = 'pending', linked_component_id = NULL
    WHERE linked_component_id = 3615
  `;
  
  // 2. Delete the mappings
  await sql`
    DELETE FROM scraper_mappings WHERE component_id = 3615
  `;

  // 3. Delete prices
  await sql`
    DELETE FROM prices WHERE component_id = 3615
  `;

  // 4. Delete the component
  await sql`
    DELETE FROM components WHERE id = 3615
  `;

  console.log('Component 3615 deleted. Unmatched listings reset to pending.');
}

fixSgPsu().catch(console.error);
