// Check remaining broken cases + identify miscategorised items
import { getSql } from '../core/db/index.js';

async function audit() {
  const sql = getSql();

  const broken = await sql`
    SELECT 
      c.id, c.name, c.brand, c.category,
      c.max_cooler_height_mm,
      c.supported_motherboards,
      c.specs->>'max_cpu_cooler_height_mm' as spec_cooler_height,
      c.specs->>'form_factors' as spec_form_factors,
      COALESCE(
        (SELECT sm.product_url FROM scraper_mappings sm WHERE sm.component_id = c.id LIMIT 1),
        (SELECT p.product_url  FROM prices p WHERE p.component_id = c.id LIMIT 1)
      ) AS product_url
    FROM components c
    WHERE c.category = 'case'
      AND (
        c.max_cooler_height_mm IS NULL
        OR c.supported_motherboards IS NULL
        OR c.specs->>'max_cpu_cooler_height_mm' IS NULL
        OR c.specs->>'form_factors' IS NULL
      )
    ORDER BY c.brand, c.name
  ` as any[];

  console.log(`\nRemaining broken cases: ${broken.length}\n`);
  for (const c of broken) {
    console.log(`[${c.id}] ${c.brand ?? '(no brand)'} | ${c.name}`);
    console.log(`      cooler_col=${c.max_cooler_height_mm} spec_cooler=${c.spec_cooler_height} form_factors_col=${JSON.stringify(c.supported_motherboards)} spec_ff=${c.spec_form_factors}`);
    console.log(`      url=${c.product_url ?? 'NONE'}`);
  }

  // Also check XTRMLAB/NOVA/SG specifically
  const local = await sql`
    SELECT id, name, brand, max_cooler_height_mm, supported_motherboards,
           specs->>'max_cpu_cooler_height_mm' as spec_cooler_height,
           specs->>'form_factors' as spec_ff
    FROM components
    WHERE brand ILIKE ANY(ARRAY['XTRMLAB','NOVA','Setup Game','SG','SETUP%'])
      AND category = 'case'
    ORDER BY brand, name
  ` as any[];
  
  console.log(`\nXTRMLAB/NOVA/SG local brands: ${local.length}`);
  for (const c of local) {
    const healStatus = (c.max_cooler_height_mm || c.spec_cooler_height) ? '✓' : '✗';
    console.log(`  ${healStatus} [${c.id}] ${c.brand} | ${c.name} | cooler=${c.max_cooler_height_mm ?? c.spec_cooler_height ?? 'NULL'} | ff=${c.spec_ff ?? JSON.stringify(c.supported_motherboards) ?? 'NULL'}`);
  }
}

audit().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
