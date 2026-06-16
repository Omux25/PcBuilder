import { getSql } from '../../src/core/db/index.js';

async function undo() {
  const sql = getSql();
  
  // Find components created in the last 15 minutes that don't have manual mappings
  const res = await sql`
    DELETE FROM components 
    WHERE created_at > NOW() - INTERVAL '30 minutes'
    AND id NOT IN (SELECT component_id FROM scraper_mappings)
    RETURNING id, name;
  `;
  
  console.log(`Deleted ${res.length} auto-created components.`);
  process.exit(0);
}

undo();
