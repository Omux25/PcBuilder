// apps/backend/scripts/debug_stale_data.ts
import { getSql } from '../src/core/db/index.js';

async function main() {
  const sql = getSql();
  console.log('--- Checking for Components without Scraper Mappings ---');
  
  const orphans = await sql`
    SELECT c.id, c.name, c.category, c.brand, c.slug
    FROM components c
    LEFT JOIN scraper_mappings sm ON sm.component_id = c.id
    WHERE sm.id IS NULL
    ORDER BY c.created_at DESC
  `;

  console.log(`Found ${orphans.length} orphan components (no links).`);
  if (orphans.length > 0) {
    console.table(orphans.slice(0, 20));
  }

  console.log('\n--- Checking Specific Buggy Items ---');
  const items = [
    'Hybrok HL360B',
    'XTRMLab XH100',
    'ML-ONE360'
  ];

  for (const name of items) {
    const results = await sql`
      SELECT c.id, c.name, c.category, COUNT(sm.id) as mapping_count
      FROM components c
      LEFT JOIN scraper_mappings sm ON sm.component_id = c.id
      WHERE c.name ILIKE ${'%' + name + '%'}
      GROUP BY c.id, c.name, c.category
    `;
    console.log(`\nSearch for "${name}":`);
    console.table(results);
  }

  process.exit(0);
}

main();
