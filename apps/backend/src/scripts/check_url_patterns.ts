import { getSql } from '../core/db/index.js';

async function checkUrlPatterns() {
  const sql = getSql();
  const categories = ['cpu', 'gpu', 'motherboard', 'ram', 'storage', 'psu', 'case', 'cooling', 'fan', 'thermal_paste'];

  for (const cat of categories) {
    console.log(`\n--- ${cat.toUpperCase()} URLs ---`);
    const urls = await sql`
      SELECT DISTINCT sm.product_url 
      FROM scraper_mappings sm
      JOIN components c ON c.id = sm.component_id
      WHERE c.category = ${cat}
      LIMIT 10;
    `;
    urls.forEach(u => console.log(u.product_url));
  }
}

checkUrlPatterns().catch(console.error);