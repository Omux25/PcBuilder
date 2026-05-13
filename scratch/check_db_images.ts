
import { sql } from 'bun';

const result = await sql`
  SELECT name, image_url, image_urls 
  FROM components 
  WHERE slug = 'amd-ryzen-3-3100'
`;

console.log(JSON.stringify(result, null, 2));
process.exit(0);
