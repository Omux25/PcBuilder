import { SQL } from 'bun';
import { aggregate } from './aggregator.js';

async function run() {
  const sql = new SQL(process.env.DATABASE_URL!);
  
  const comp = await sql`SELECT id, name, brand, category, slug FROM components LIMIT 1`;
  const name = `${comp[0].brand} ${comp[0].name}`;
  
  const dummyPrice = {
    retailer_id: 1,
    product_url: 'https://test.com/product/123',
    product_name: name,
    price: 999.99,
    in_stock: true,
    image_url: null,
    manual_category: comp[0].category
  };

  const urlToId = new Map([['https://test.com', 1]]);
  
  console.log('Dummy name:', name);
  console.log('Target Slug:', comp[0].slug);
  
  const result = await aggregate([dummyPrice], urlToId, {});
  
  console.log('Result:', result);
  
  await sql`DELETE FROM scraper_mappings WHERE product_url = 'https://test.com/product/123'`;
  await sql`DELETE FROM prices WHERE product_url = 'https://test.com/product/123'`;
  await sql`DELETE FROM unmatched_listings WHERE product_url = 'https://test.com/product/123'`;
  
  process.exit(0);
}
run();
