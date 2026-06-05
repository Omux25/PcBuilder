import { sql } from 'bun';

console.log('Searching for "wifi" in prices product URLs:');
const pUrls = await sql`
  SELECT DISTINCT product_url
  FROM prices
  WHERE product_url ILIKE '%wifi%' OR product_url ILIKE '%wi-fi%'
  LIMIT 20
`;
console.log(JSON.stringify(pUrls, null, 2));

console.log('\nSearching for "wifi" in scraper_mappings product URLs:');
const mUrls = await sql`
  SELECT DISTINCT product_url
  FROM scraper_mappings
  WHERE product_url ILIKE '%wifi%' OR product_url ILIKE '%wi-fi%'
  LIMIT 20
`;
console.log(JSON.stringify(mUrls, null, 2));

console.log('\nSearching for "wifi" in unmatched_listings title or URL:');
const unListings = await sql`
  SELECT id, title, product_url
  FROM unmatched_listings
  WHERE title ILIKE '%wifi%' OR title ILIKE '%wi-fi%' OR product_url ILIKE '%wifi%'
  LIMIT 20
`;
console.log(JSON.stringify(unListings, null, 2));

process.exit(0);
