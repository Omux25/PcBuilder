import { getSql } from './src/core/db/index.js';
const sql = getSql();
const rows = await sql`SELECT count(*) as total, count(image_url) as with_image FROM unmatched_listings WHERE scraped_name ILIKE '%Ryzen 5 3600%'`;
console.log(rows);
process.exit(0);
