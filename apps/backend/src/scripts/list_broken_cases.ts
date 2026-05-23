import { getSql } from '../core/db/index.js';

async function listBrokenCases() {
  const sql = getSql();
  const cases = await sql`
    SELECT id, name, brand, max_gpu_length_mm, specs
    FROM components
    WHERE category = 'case' 
      AND (max_gpu_length_mm IS NULL OR specs->>'form_factors' IS NULL)
  `;
  
  console.log(JSON.stringify(cases, null, 2));
}

listBrokenCases().catch(console.error);
