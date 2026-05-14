
import { getSql } from '../core/db/index.js';

async function checkSpecs() {
  const sql = getSql();
  
  // Check if case specs are actually stored in the DB somewhere else, or if the columns exist.
  const columns = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'components' AND column_name LIKE 'case_%';
  `;
  console.log("Case columns:", columns);
  
  const caseWithSpecs = await sql`
    SELECT id, name, form_factor, side_panel, max_gpu_length_mm
    FROM components
    WHERE category = 'case' AND form_factor IS NOT NULL
    LIMIT 3;
  `;
  console.log("Cases with explicit spec columns filled:", caseWithSpecs);
}

checkSpecs().catch(console.error);
