
import { getSql } from '../core/db/index.js';
import { inferCategory } from '../../../../shared/hardware/categories.js';

async function testCases() {
  const names = [
    'Cougar Ventilateur Vortex RGB Fcb 120',
    'Deskooze Triangle Beast',
    'Lian Li O11 Dynamic Mini V2 Flow',
    'Setup Game Sg'
  ];

  for (const n of names) {
    console.log(`"${n}" -> ${inferCategory(n)}`);
  }

  const sql = getSql();
  const sgRows = await sql`
    SELECT id, name, brand, category
    FROM components
    WHERE brand = 'Setup Game' AND name = 'Sg'
  `;
  for (const row of sgRows) {
    const mappings = await sql`SELECT product_identifier, product_url FROM scraper_mappings WHERE component_id = ${row.id}`;
    console.log(`\nComponent ID ${row.id} Mappings:`);
    for (const m of mappings) {
      console.log(`- ${m.product_identifier} (${m.product_url})`);
    }
  }
}

testCases().catch(console.error);
