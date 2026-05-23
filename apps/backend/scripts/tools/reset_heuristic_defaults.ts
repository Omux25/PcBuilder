import { getSql } from '../../src/core/db/index.js';
import { inferCategory } from '../../../../shared/hardware/categories.js';

const sql = getSql();

async function run() {
  console.log('🏁 Starting one-shot database cleanup and spec reset...\n');

  // 1. Move misclassified cases (e.g. Antec PSUs) using the fixed inferCategory rules
  const cases = await sql`SELECT id, name FROM components WHERE category = 'case'` as any[];
  let movedCount = 0;
  for (const c of cases) {
    const correctCat = inferCategory(c.name);
    if (correctCat && correctCat !== 'case' && correctCat !== 'other') {
      console.log(`📦 Moving misclassified component: [${c.id}] "${c.name}" -> category: ${correctCat}`);
      await sql`UPDATE components SET category = ${correctCat}, updated_at = NOW() WHERE id = ${c.id}`;
      movedCount++;
    }
  }

  // 1b. Reverse check: Move components currently in ('gpu', 'cooling', 'psu') that should actually be 'case'
  const potentialCases = await sql`SELECT id, name, category FROM components WHERE category IN ('gpu', 'cooling', 'psu')` as any[];
  for (const pc of potentialCases) {
    const correctCat = inferCategory(pc.name);
    if (correctCat === 'case') {
      console.log(`📦 Moving back to Case: [${pc.id}] "${pc.name}" (currently ${pc.category}) -> category: case`);
      await sql`UPDATE components SET category = 'case', updated_at = NOW() WHERE id = ${pc.id}`;
      movedCount++;
    }
  }
  console.log(`✅ Category corrections complete. Updated ${movedCount} components.\n`);

  // 2. Reset Case heuristic default specs back to NULL
  console.log('🔄 Resetting Case heuristic defaults (330mm GPU / 160mm Cooler)...');
  const caseReset = await sql`
    UPDATE components
    SET max_gpu_length_mm = NULL,
        max_cooler_height_mm = NULL,
        supported_motherboards = NULL,
        specs = NULL,
        specs_last_mined_at = NULL,
        updated_at = NOW()
    WHERE category = 'case'
      AND max_gpu_length_mm = 330
      AND max_cooler_height_mm = 160
  ` as any;
  console.log(`✅ Case reset complete: ${caseReset.count ?? 0} rows reset to NULL.\n`);

  // 3. Reset Cooler heuristic default specs back to NULL
  console.log('🔄 Resetting Cooling heuristic defaults (200W TDP)...');
  const coolerReset = await sql`
    UPDATE components
    SET max_tdp = NULL,
        specs = NULL,
        specs_last_mined_at = NULL,
        updated_at = NOW()
    WHERE category = 'cooling'
      AND max_tdp = 200
  ` as any;
  console.log(`✅ Cooling reset complete: ${coolerReset.count ?? 0} rows reset to NULL.\n`);

  console.log('✨ All heuristic defaults successfully cleared! Database is ready for spec mining enrichment.');
}

run()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Error during cleanup/reset:', err);
    process.exit(1);
  });
