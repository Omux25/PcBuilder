import { getSql } from '../apps/backend/src/core/db/index.js';

async function main() {
  const sql = getSql();
  
  console.log('--- Components containing 3900X ---');
  const components = await sql`
    SELECT id, name, slug, category, brand, is_active
    FROM components
    WHERE name ILIKE '%3900X%' OR slug ILIKE '%3900x%'
  `;
  console.log(JSON.stringify(components, null, 2));

  if (components.length > 0) {
    const ids = components.map(c => c.id);
    
    console.log('\n--- Scraper Mappings for those components ---');
    const mappings = await sql`
      SELECT id, component_id, retailer_id, external_id, external_name, url
      FROM scraper_mappings
      WHERE component_id IN (${ids})
    `;
    console.log(JSON.stringify(mappings, null, 2));

    console.log('\n--- Prices for those components ---');
    const prices = await sql`
      SELECT id, component_id, retailer_id, price, is_in_stock
      FROM prices
      WHERE component_id IN (${ids})
    `;
    console.log(JSON.stringify(prices, null, 2));
  }
  
  process.exit(0);
}

main().catch(console.error);
