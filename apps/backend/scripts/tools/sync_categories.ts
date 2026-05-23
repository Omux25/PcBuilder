import { getSql } from '../../src/core/db/index.js';
import { inferCategory } from '../../../../shared/hardware/categories.js';

const sql = getSql();

async function run() {
  console.log('🏁 Starting database category synchronization based on updated category rules...\n');

  const components = await sql`
    SELECT id, name, category, brand 
    FROM components 
    WHERE is_active = true
  ` as any[];

  console.log(`🔍 Auditing ${components.length} components...`);

  let updatedCount = 0;
  for (const comp of components) {
    const inferred = inferCategory(comp.name);
    if (inferred && inferred !== comp.category) {
      console.log(`📦 Correcting Category: [${comp.id}] "${comp.name}" (${comp.category} ➔ ${inferred})`);
      await sql`
        UPDATE components 
        SET category = ${inferred}, updated_at = NOW() 
        WHERE id = ${comp.id}
      `;
      updatedCount++;
    }
  }

  console.log(`\n✨ Synchronized ${updatedCount} component categories successfully!`);
}

run()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Error during synchronization:', err);
    process.exit(1);
  });
