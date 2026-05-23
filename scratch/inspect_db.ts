import { getSql } from '../apps/backend/src/core/db/index';

async function run() {
  const sql = getSql();
  
  console.log("--- Checking unmatched_listings ---");
  const unmatched = await sql`
    SELECT * FROM unmatched_listings 
    WHERE product_url LIKE '%6531%' OR scraped_name LIKE '%3900X%'
  `;
  console.log("Unmatched Listings:", JSON.stringify(unmatched, null, 2));

  console.log("\n--- Checking components ---");
  const components = await sql`
    SELECT * FROM components 
    WHERE slug LIKE '%3900x%' OR name LIKE '%3900X%'
  `;
  console.log("Components:", JSON.stringify(components, null, 2));

  console.log("\n--- Checking scraper_mappings ---");
  const mappings = await sql`
    SELECT * FROM scraper_mappings 
    WHERE product_url LIKE '%6531%'
  `;
  console.log("Mappings:", JSON.stringify(mappings, null, 2));

  console.log("\n--- Checking prices ---");
  const prices = await sql`
    SELECT * FROM prices 
    WHERE product_url LIKE '%6531%'
  `;
  console.log("Prices:", JSON.stringify(prices, null, 2));
}

run().catch(console.error);
