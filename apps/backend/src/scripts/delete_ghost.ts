import { getSql } from '../core/db/index.js';

async function deleteGhost() {
  const sql = getSql();
  await sql`DELETE FROM prices WHERE component_id = 5534`;
  await sql`DELETE FROM scraper_mappings WHERE component_id = 5534`;
  await sql`DELETE FROM components WHERE id = 5534`;
  console.log('Ghost deleted.');
}

deleteGhost().catch(console.error);