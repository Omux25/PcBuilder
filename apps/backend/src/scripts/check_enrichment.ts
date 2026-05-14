
import { getSql } from '../core/db/index.js';

async function checkSpecsMissing() {
  const sql = getSql();
  console.log('--- CHECKING ENRICHMENT QUEUE ---');
  
  const pending = await sql`
    SELECT COUNT(*) 
    FROM components c
    WHERE c.category = 'case' 
      AND (c.specs IS NULL OR c.specs::text = '{}' OR c.image_url IS NULL)
  `;
  console.log(`Pending cases for enrichment: ${pending[0].count}`);

  const enriched = await sql`
    SELECT id, name, category, specs, image_url 
    FROM components 
    WHERE category = 'case' AND specs IS NOT NULL AND specs::text != '{}'
    LIMIT 1;
  `;
  console.log(`Cases successfully enriched:`, enriched.length > 0 ? enriched[0] : 'None found with specs JSON');

  const typedColumns = await sql`
    SELECT id, name, form_factor, max_gpu_length_mm
    FROM components 
    WHERE category = 'case' AND form_factor IS NOT NULL
    LIMIT 1;
  `;
  console.log(`Cases successfully enriched (Typed Columns):`, typedColumns.length > 0 ? typedColumns[0] : 'None found with typed columns');
}

checkSpecsMissing().catch(console.error);
