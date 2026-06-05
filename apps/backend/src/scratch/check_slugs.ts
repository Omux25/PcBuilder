import { getSql } from '../core/db/index.js';

async function check() {
  const sql = getSql();
  const nullSlugs = await sql`SELECT id, name, brand FROM components WHERE slug IS NULL`;
  console.log('Components with NULL slugs:', nullSlugs);

  const duplicateSlugs = await sql`
    SELECT slug, COUNT(*) 
    FROM components 
    GROUP BY slug 
    HAVING COUNT(*) > 1
  `;
  console.log('Duplicate slugs:', duplicateSlugs);
}

check().catch(console.error);
