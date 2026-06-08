import { getSql } from './src/core/db/index.js';
const sql = getSql();
const rows = await sql`SELECT id, scraped_name, image_url, image_urls FROM unmatched_listings WHERE scraped_name ILIKE '%Ryzen 5 3600%' LIMIT 5`;
console.log(rows);
process.exit(0);
