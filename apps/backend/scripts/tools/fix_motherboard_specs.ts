/**
 * fix_motherboard_specs.ts
 *
 * Two-pass fix for the motherboard category:
 *
 * Pass 1 — Remove non-motherboards:
 *   - EMTEC X150 SSDs → storage
 *   - Thermaltake H590 TG ARGB → case
 *   - MSI MAG A300N/A500N/A550BN/A650BN, MPG A750GF/A1000G → psu
 *   - "B660M" brand with "GAMING AC" name → fix brand to Gigabyte
 *   - "UD AX DDR4" (Gigabyte, truncated name) → deactivate
 *
 * Pass 2 — Backfill socket + supported_ram_types + max_ram_frequency
 *   for all motherboards using inferMotherboardSpecs().
 *
 * Pass 3 — Fix any remaining malformed array values (escaped inner quotes).
 *
 * Run: bun run scripts/tools/fix_motherboard_specs.ts
 */

import { sql } from 'bun';
import { extractMotherboardSpecs } from '@shared/hardware/specs/motherboard';

console.log('🔧 Fixing motherboard category\n');

// ── Pass 1: Remove non-motherboards ──────────────────────────────────────────

console.log('Pass 1: Fixing miscategorized components...\n');

const emtecFixed = await sql`
  UPDATE components SET category = 'storage'
  WHERE category = 'motherboard' AND brand = 'EMTEC'
  RETURNING id, name
` as { id: number; name: string }[];
for (const r of emtecFixed) console.log(`  ✅ storage ← ${r.name}`);

const ttFixed = await sql`
  UPDATE components SET category = 'case'
  WHERE category = 'motherboard' AND brand = 'Thermaltake' AND name ILIKE '%H590%'
  RETURNING id, name
` as { id: number; name: string }[];
for (const r of ttFixed) console.log(`  ✅ case ← ${r.name}`);

const msiPsuFixed = await sql`
  UPDATE components SET category = 'psu'
  WHERE category = 'motherboard' AND brand = 'MSI'
    AND (name ~ 'MAG A[0-9]+[A-Z]' OR name ~ 'MPG A[0-9]+[A-Z]')
  RETURNING id, name
` as { id: number; name: string }[];
for (const r of msiPsuFixed) console.log(`  ✅ psu ← ${r.name}`);

const brandFixed = await sql`
  UPDATE components SET brand = 'Gigabyte', name = 'B660M GAMING AC'
  WHERE category = 'motherboard' AND brand = 'B660M'
  RETURNING id, name
` as { id: number; name: string }[];
for (const r of brandFixed) console.log(`  ✅ brand fixed → Gigabyte ${r.name}`);

const deactivated = await sql`
  UPDATE components SET is_active = false
  WHERE category = 'motherboard' AND brand = 'Gigabyte' AND name = 'UD AX DDR4'
  RETURNING id, name
` as { id: number; name: string }[];
for (const r of deactivated) console.log(`  ⚠️  deactivated (truncated name) ← ${r.name}`);

console.log(`\n  Moved to storage: ${emtecFixed.length}`);
console.log(`  Moved to case:    ${ttFixed.length}`);
console.log(`  Moved to psu:     ${msiPsuFixed.length}`);
console.log(`  Brand fixed:      ${brandFixed.length}`);
console.log(`  Deactivated:      ${deactivated.length}`);

// ── Pass 2: Backfill specs for all motherboards ───────────────────────────────

console.log('\nPass 2: Backfilling socket + RAM type for all motherboards...\n');

const boards = await sql`
  SELECT id, name, brand FROM components
  WHERE category = 'motherboard' AND is_active = true
  ORDER BY name
` as { id: number; name: string; brand: string }[];

console.log(`  Total motherboards to process: ${boards.length}`);

let updated = 0;
let skipped = 0;
const skippedNames: string[] = [];

for (const board of boards) {
  const specs = extractMotherboardSpecs(board.name);
  if (!specs) {
    skipped++;
    skippedNames.push(`${board.brand} ${board.name}`);
    continue;
  }
  await sql`
    UPDATE components
    SET
      socket              = ${specs.socket},
      supported_ram_types = ${sql.array(specs.supported_ram_types)},
      max_ram_frequency   = ${specs.max_ram_frequency}
    WHERE id = ${board.id}
  `;
  updated++;
}

console.log(`  Updated: ${updated}`);
console.log(`  Skipped (no chipset identified): ${skipped}`);

if (skippedNames.length > 0) {
  console.log('\n  Skipped boards (review manually):');
  for (const n of skippedNames) console.log(`    - ${n}`);
}

// ── Pass 3: Fix remaining malformed array values ──────────────────────────────
// Boards that were skipped in Pass 2 may still have old malformed values like
// ['"DDR4"'] from a previous serialization bug. Fix them with raw SQL.

console.log('\nPass 3: Fixing malformed array values...\n');

await sql.unsafe(`
  UPDATE components
  SET supported_ram_types = ARRAY['DDR4']
  WHERE category = 'motherboard'
    AND supported_ram_types IS NOT NULL
    AND array_to_string(supported_ram_types, ',') LIKE '%"DDR4"%'
`);

await sql.unsafe(`
  UPDATE components
  SET supported_ram_types = ARRAY['DDR5']
  WHERE category = 'motherboard'
    AND supported_ram_types IS NOT NULL
    AND array_to_string(supported_ram_types, ',') LIKE '%"DDR5"%'
`);

console.log('  ✅ Done');

// ── Verification ──────────────────────────────────────────────────────────────

console.log('\n── Verification ──────────────────────────────────────────────────');

const stats = await sql`
  SELECT
    COUNT(*) FILTER (WHERE supported_ram_types IS NOT NULL) as with_ram,
    COUNT(*) FILTER (WHERE supported_ram_types IS NULL)     as without_ram,
    COUNT(*) FILTER (WHERE socket IS NOT NULL)              as with_socket,
    COUNT(*) FILTER (WHERE socket IS NULL)                  as without_socket,
    COUNT(*) as total
  FROM components
  WHERE category = 'motherboard' AND is_active = true
` as any[];

const s = stats[0];
console.log(`  Total active motherboards: ${s.total}`);
console.log(`  With socket:    ${s.with_socket} / ${s.total}`);
console.log(`  With RAM type:  ${s.with_ram} / ${s.total}`);
console.log(`  Missing socket: ${s.without_socket}`);
console.log(`  Missing RAM:    ${s.without_ram}`);

const ramDist = await sql`
  SELECT array_to_string(supported_ram_types, ',') as ram, COUNT(*) as cnt
  FROM components
  WHERE category = 'motherboard' AND is_active = true
  GROUP BY 1
  ORDER BY cnt DESC
` as any[];

console.log('\n  RAM type distribution:');
for (const r of ramDist) {
  console.log(`    ${r.ram ?? 'null'}: ${r.cnt}`);
}

const socketDist = await sql`
  SELECT socket, COUNT(*) as cnt
  FROM components
  WHERE category = 'motherboard' AND is_active = true
  GROUP BY socket
  ORDER BY cnt DESC
` as any[];

console.log('\n  Socket distribution:');
for (const r of socketDist) {
  console.log(`    ${r.socket ?? 'null'}: ${r.cnt}`);
}

console.log('\n✅ Done!\n');
process.exit(0);
