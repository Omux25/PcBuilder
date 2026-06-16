import { getSql } from './src/core/db/index.js';

async function main() {
    const sql = getSql();
    try {
        const rows = await sql`SELECT id, scraped_name, retailer_id, product_url, image_url, image_urls FROM unmatched_listings WHERE scraped_name ILIKE '%Matrexx 55%' LIMIT 5;`;
        console.log(JSON.stringify(rows, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}
main();
