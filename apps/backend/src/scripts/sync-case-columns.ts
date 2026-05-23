/**
 * sync-case-columns.ts
 *
 * One-shot fix: for all 'case' category components where the specs JSONB
 * already contains max_cpu_cooler_height_mm or form_factors, but the dedicated
 * columns (max_cooler_height_mm, supported_motherboards) are still NULL —
 * sync the JSONB data into the proper columns.
 *
 * This also flags the 5 clearly-miscategorised records (GPU/coolers that
 * ended up in category='case') for manual review.
 */

import { getSql } from '../core/db/index.js';

async function syncCaseColumns() {
  const sql = getSql();

  console.log('[SyncCaseColumns] Syncing specs JSONB → dedicated columns...');

  // 1. Sync max_cooler_height_mm from JSONB where column is NULL but JSONB has the value
  const coolerSync = await sql`
    UPDATE components
    SET
      max_cooler_height_mm = (specs->>'max_cpu_cooler_height_mm')::int,
      updated_at = NOW()
    WHERE category = 'case'
      AND max_cooler_height_mm IS NULL
      AND specs->>'max_cpu_cooler_height_mm' IS NOT NULL
      AND (specs->>'max_cpu_cooler_height_mm')::int BETWEEN 60 AND 220
  ` as any;
  console.log(`  max_cooler_height_mm synced: ${coolerSync.count ?? '?'} rows`);

  // 2. Sync supported_motherboards from JSONB form_factors where column is NULL
  //    JSONB stores it as a JSON array string like ["ATX","Micro-ATX","Mini-ITX"]
  const ffSync = await sql`
    UPDATE components
    SET
      supported_motherboards = ARRAY(
        SELECT jsonb_array_elements_text(specs->'form_factors')
      )::character varying[],
      updated_at = NOW()
    WHERE category = 'case'
      AND supported_motherboards IS NULL
      AND specs->'form_factors' IS NOT NULL
      AND jsonb_typeof(specs->'form_factors') = 'array'
  ` as any;
  console.log(`  supported_motherboards synced: ${ffSync.count ?? '?'} rows`);

  // 3. Report what's still broken after sync
  const remaining = await sql`
    SELECT id, name, brand, category,
           max_cooler_height_mm,
           supported_motherboards,
           specs->>'max_cpu_cooler_height_mm' as spec_cooler,
           specs->>'form_factors' as spec_ff
    FROM components
    WHERE category = 'case'
      AND (max_cooler_height_mm IS NULL OR supported_motherboards IS NULL)
    ORDER BY brand, name
  ` as any[];

  if (remaining.length === 0) {
    console.log('\n[SyncCaseColumns] ✓ All cases are fully resolved!');
  } else {
    console.log(`\n[SyncCaseColumns] ${remaining.length} cases still have gaps (likely miscategorised):`);
    for (const c of remaining) {
      console.log(`  [${c.id}] ${c.brand ?? '(no brand)'} | ${c.name}`);
      console.log(`        cooler_col=${c.max_cooler_height_mm ?? 'NULL'} | ff_col=${JSON.stringify(c.supported_motherboards) ?? 'NULL'}`);
      console.log(`        spec_cooler=${c.spec_cooler ?? 'NULL'} | spec_ff=${c.spec_ff ?? 'NULL'}`);
    }
  }
}

syncCaseColumns()
  .then(() => process.exit(0))
  .catch(err => { console.error('[SyncCaseColumns] Error:', err); process.exit(1); });
