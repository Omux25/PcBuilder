
import { getSql } from '../core/db/index.js';
import { cleanName } from '../../../../shared/hardware/cleaning.js';

async function recleanCases() {
  const sql = getSql();
  console.log('--- RECLEANING CASE NAMES ---');

  const cases = await sql`
    SELECT id, name, brand, category
    FROM components
    WHERE category = 'case'
  ` as any[];

  let updated = 0;
  for (const c of cases) {
    const originalName = c.name;
    const newName = cleanName(originalName, c.brand, 'case');

    if (newName !== originalName) {
      console.log(`[UPDATE] ID ${c.id}: "${originalName}" -> "${newName}"`);
      await sql`UPDATE components SET name = ${newName}, updated_at = NOW() WHERE id = ${c.id}`;
      updated++;
    }
  }

  console.log(`\nComplete. Updated ${updated} case names.`);
}

recleanCases().catch(console.error);
