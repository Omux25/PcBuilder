// apps/backend/scripts/find_item.ts
import { getSql } from '../src/core/db/index.js';

async function main() {
  const sql = getSql();
  const search = process.argv[2];
  if (!search) {
    console.log('Provide a search term');
    process.exit(1);
  }

  console.log(`Searching for "${search}"...`);
  
  const components = await sql`
    SELECT c.id, c.name, c.category, sm.product_url
    FROM components c
    LEFT JOIN scraper_mappings sm ON sm.component_id = c.id
    WHERE c.name ILIKE ${'%' + search + '%'}
       OR sm.product_url ILIKE ${'%' + search + '%'}
  `;

  console.table(components);
  process.exit(0);
}

main();
