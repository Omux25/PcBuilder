import { getSql } from '../core/db/index.js';

const RENAMES = {
  'Atlas Entry': 'Atlas Spark',
  'Titan MA': 'Oasis Horizon',
  'Atlantic Ultra': 'Atlantic Zenith',
  'Casablanca Pro': 'Casablanca Infinite',
  'Rif Data Station': 'Rif Nexus'
};

async function run() {
  const sql = getSql();
  
  console.log('--- RENAMING PRESETS TO PREMIUM NAMES ---');
  
  for (const [oldName, newName] of Object.entries(RENAMES)) {
    const updated = await sql`
      UPDATE preset_builds
      SET name = ${newName}
      WHERE name = ${oldName}
      RETURNING id, name
    `;
    if (updated.length > 0) {
      console.log(`  [SUCCESS] Renamed: "${oldName}" -> "${newName}"`);
    } else {
      console.log(`  [SKIP] Could not find preset named "${oldName}" (maybe already renamed?)`);
    }
  }
  
  console.log('--- RENAMING COMPLETE ---');
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
