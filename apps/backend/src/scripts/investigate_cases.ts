
import { getSql } from '../core/db/index.js';

async function investigate() {
  const sql = getSql();

  console.log('--- INVESTIGATING SG61-4FB ---');
  const sg61 = await sql`
    SELECT c.id, c.name, c.brand, c.category, sm.product_identifier, sm.product_url
    FROM components c
    LEFT JOIN scraper_mappings sm ON sm.component_id = c.id
    WHERE c.name ILIKE '%Sg61%' OR sm.product_identifier ILIKE '%Sg61%'
  ` as any[];
  console.log(sg61);

  console.log('\n--- INVESTIGATING ANTEC CX300 ---');
  const antec = await sql`
    SELECT c.id, c.name, c.brand, c.category, sm.product_identifier
    FROM components c
    LEFT JOIN scraper_mappings sm ON sm.component_id = c.id
    WHERE c.name ILIKE '%Cx300%' AND c.brand = 'Antec'
  ` as any[];
  console.log(antec);

  console.log('\n--- CASES MISSING IMAGES/SPECS ---');
  const missingStats = await sql`
    SELECT count(*) as total, 
           COUNT(c.image_url) as with_image,
           SUM(CASE WHEN c.image_url IS NULL THEN 1 ELSE 0 END) as without_image,
           SUM(CASE WHEN c.specs IS NULL OR c.specs::text = '{}' THEN 1 ELSE 0 END) as without_specs
    FROM components c
    WHERE c.category = 'case'
  ` as any[];
  console.log(missingStats[0]);
  
  const sampleMissing = await sql`
    SELECT id, name, brand, created_at, updated_at
    FROM components
    WHERE category = 'case' AND image_url IS NULL
    LIMIT 3;
  `;
  console.log('Sample missing image:', sampleMissing);
}

investigate().catch(console.error);
