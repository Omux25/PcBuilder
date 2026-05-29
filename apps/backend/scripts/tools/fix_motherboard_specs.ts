/**
 * fix_motherboard_specs.ts
 *
 * Maintenance and backfill script for the motherboard category.
 * Performs a comprehensive database alignment:
 *   - Pass 1: Move miscategorized components (SSD, Cases, PSUs) to their proper categories
 *   - Pass 2: Clean motherboard names (strip Cm / : Cm noise), recover WiFi models from product URLs, generate new slugs
 *   - Pass 3: Extract specs (socket, chipset, form_factor, ram_slots, RAM types) and backfill all columns
 *   - Pass 4: Clean up any inner-quoted array formatting natively
 *   - Pass 5: Heal specs JSONB double-serialization corruption natively
 *
 * Run: bun run scripts/tools/fix_motherboard_specs.ts
 */

import { sql } from 'bun';
import { extractMotherboardSpecs } from '@shared/hardware/specs/motherboard';
import { cleanName } from '@shared/hardware/cleaning';

console.log('🔧 Revamping Motherboard Specifications & Names...\n');

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

const corsairFixed = await sql`
  UPDATE components SET category = 'cooling'
  WHERE category = 'motherboard' AND brand = 'Corsair' AND name = 'A500'
  RETURNING id, name
` as { id: number; name: string }[];
for (const r of corsairFixed) console.log(`  ✅ cooling ← ${r.name}`);

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
console.log(`  Moved to cooling: ${corsairFixed.length}`);
console.log(`  Brand fixed:      ${brandFixed.length}`);
console.log(`  Deactivated:      ${deactivated.length}`);

// ── Pass 2: Clean Names, Specs & Heal JSONB Serialization ────────────────────

console.log('\nPass 2: Re-cleaning names & backfilling specs for all motherboards...\n');

const boards = await sql`
  SELECT id, name, brand, slug FROM components
  WHERE category = 'motherboard' AND is_active = true
  ORDER BY name
` as { id: number; name: string; brand: string; slug: string }[];

console.log(`  Total motherboards to process: ${boards.length}`);

let updated = 0;
let nameChanges = 0;
let wifiRestored = 0;
let skipped = 0;
const skippedNames: string[] = [];

// Helper to generate a safe slug
function makeSlug(brand: string, name: string): string {
  return `${brand.toLowerCase()}-${name.toLowerCase()}`
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

for (const board of boards) {
  // 1. Clean the name using our improved normalizer (which now preserves WiFi)
  let cleanedName = cleanName(board.name, board.brand, 'motherboard');

  // 2. WiFi Recovery Heuristic: Check if any pricing URL for this component contains wifi
  const prices = await sql`
    SELECT product_url FROM prices WHERE component_id = ${board.id}
  ` as { product_url: string }[];

  const hasWifiUrl = prices.some(p => p.product_url.toLowerCase().includes('wifi') || p.product_url.toLowerCase().includes('wi-fi'));
  
  if (hasWifiUrl && !cleanedName.toUpperCase().includes('WIFI') && !cleanedName.toUpperCase().includes('WI-FI')) {
    cleanedName = `${cleanedName} WiFi`;
    wifiRestored++;
  }

  let newSlug = board.slug;
  if (cleanedName !== board.name) {
    nameChanges++;
    newSlug = makeSlug(board.brand, cleanedName);
  }

  // 3. Extract up-to-date specs
  const specs = extractMotherboardSpecs(cleanedName, board.brand);
  if (!specs) {
    skipped++;
    skippedNames.push(`${board.brand} ${board.name}`);
    continue;
  }

  // 4. Construct a direct (non-double-escaped) specs payload object
  const specsPayload = {
    socket: specs.socket ?? null,
    chipset: specs.chipset ?? null,
    supported_ram_types: specs.supported_ram_types ?? null,
    max_ram_frequency: specs.max_ram_frequency ?? null,
    form_factor: specs.form_factor ?? null,
    ram_slots: specs.ram_slots ?? null,
  };

  // 5. Persistence pass to align all motherboard specs columns natively
  await sql`
    UPDATE components
    SET
      name                = ${cleanedName},
      slug                = ${newSlug},
      socket              = ${specs.socket},
      chipset             = ${specs.chipset},
      form_factor         = ${specs.form_factor},
      ram_slots           = ${specs.ram_slots},
      supported_ram_types = ${sql.array(specs.supported_ram_types)},
      max_ram_frequency   = ${specs.max_ram_frequency},
      specs               = ${specsPayload}
    WHERE id = ${board.id}
  `;

  updated++;
}

console.log(`  Processed / Updated: ${updated}`);
console.log(`  Name changes applied: ${nameChanges}`);
console.log(`  WiFi motherboards restored: ${wifiRestored}`);
console.log(`  Skipped (no chipset identified): ${skipped}`);

if (skippedNames.length > 0) {
  console.log('\n  Skipped boards (review manually):');
  for (const n of skippedNames) console.log(`    - ${n}`);
}

// ── Pass 3: Repair Escaped Array Formatting ───────────────────────────────────

console.log('\nPass 3: Repairing escaped array formatting...\n');

const d4Rows = await sql`
  UPDATE components
  SET supported_ram_types = ARRAY['DDR4']
  WHERE category = 'motherboard'
    AND supported_ram_types IS NOT NULL
    AND (
      array_to_string(supported_ram_types, ',') LIKE '%"DDR4"%'
      OR array_to_string(supported_ram_types, ',') = 'DDR4'
    )
  RETURNING id
`;

const d5Rows = await sql`
  UPDATE components
  SET supported_ram_types = ARRAY['DDR5']
  WHERE category = 'motherboard'
    AND supported_ram_types IS NOT NULL
    AND (
      array_to_string(supported_ram_types, ',') LIKE '%"DDR5"%'
      OR array_to_string(supported_ram_types, ',') = 'DDR5'
    )
  RETURNING id
`;

console.log(`  Healed DDR4 arrays: ${d4Rows.length}`);
console.log(`  Healed DDR5 arrays: ${d5Rows.length}`);

// ── Verification ──────────────────────────────────────────────────────────────

console.log('\n── Verification ──────────────────────────────────────────────────');

const stats = await sql`
  SELECT
    COUNT(*) FILTER (WHERE supported_ram_types IS NOT NULL) as with_ram,
    COUNT(*) FILTER (WHERE supported_ram_types IS NULL)     as without_ram,
    COUNT(*) FILTER (WHERE socket IS NOT NULL)              as with_socket,
    COUNT(*) FILTER (WHERE socket IS NULL)                  as without_socket,
    COUNT(*) FILTER (WHERE chipset IS NOT NULL)             as with_chipset,
    COUNT(*) FILTER (WHERE chipset IS NULL)                 as without_chipset,
    COUNT(*) as total
  FROM components
  WHERE category = 'motherboard' AND is_active = true
` as any[];

const s = stats[0];
console.log(`  Total active motherboards: ${s.total}`);
console.log(`  With socket:    ${s.with_socket} / ${s.total}`);
console.log(`  With chipset:   ${s.with_chipset} / ${s.total}`);
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

const slotDist = await sql`
  SELECT ram_slots, COUNT(*) as cnt
  FROM components
  WHERE category = 'motherboard' AND is_active = true
  GROUP BY ram_slots
  ORDER BY cnt DESC
` as any[];

console.log('\n  RAM slots distribution:');
for (const r of slotDist) {
  console.log(`    ${r.ram_slots ?? 'null'}: ${r.cnt}`);
}

console.log('\n✅ Done!\n');
process.exit(0);
