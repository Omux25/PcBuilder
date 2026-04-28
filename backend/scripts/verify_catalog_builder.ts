/**
 * verify_catalog_builder.ts
 * End-to-end quality check on what catalogBuilder created.
 * Checks for: wrong category, missing required fields, bad specs,
 * duplicate entries, and mappings pointing to wrong components.
 */
import { sql } from 'bun';

let issues = 0;
function fail(msg: string) { console.error(`  ✗ ${msg}`); issues++; }
function ok(msg: string)   { console.log(`  ✓ ${msg}`); }

// ── 1. CPUs: must have socket ─────────────────────────────────────────────────
console.log('\n=== CPUs without socket ===');
const cpuNoSocket = await sql`
  SELECT id, name, brand FROM components
  WHERE category = 'cpu' AND is_active = true
    AND (socket IS NULL OR socket = '')
  ORDER BY id DESC LIMIT 20
` as { id: number; name: string; brand: string }[];

if (cpuNoSocket.length === 0) ok('All CPUs have socket');
else cpuNoSocket.forEach(c => fail(`[${c.id}] ${c.brand} ${c.name} — missing socket`));

// ── 2. GPUs: must have length_mm ─────────────────────────────────────────────
console.log('\n=== GPUs without length_mm ===');
const gpuNoLength = await sql`
  SELECT id, name, brand FROM components
  WHERE category = 'gpu' AND is_active = true
    AND (length_mm IS NULL OR length_mm = 0)
  ORDER BY id DESC LIMIT 20
` as { id: number; name: string; brand: string }[];

if (gpuNoLength.length === 0) ok('All GPUs have length_mm');
else gpuNoLength.forEach(c => fail(`[${c.id}] ${c.brand} ${c.name} — missing length_mm`));

// ── 3. RAM: must have ram_type and frequency_mhz ─────────────────────────────
console.log('\n=== RAM without ram_type or frequency ===');
const ramBad = await sql`
  SELECT id, name, brand, ram_type, frequency_mhz FROM components
  WHERE category = 'ram' AND is_active = true
    AND (ram_type IS NULL OR frequency_mhz IS NULL OR frequency_mhz < 2133)
  ORDER BY id DESC LIMIT 20
` as { id: number; name: string; brand: string; ram_type: string; frequency_mhz: number }[];

if (ramBad.length === 0) ok('All RAM entries have ram_type and frequency');
else ramBad.forEach(c => fail(`[${c.id}] ${c.brand} ${c.name} — ram_type=${c.ram_type} freq=${c.frequency_mhz}`));

// ── 4. Motherboards: must have socket and supported_ram_types ────────────────
console.log('\n=== Motherboards without socket or RAM types ===');
const mbBad = await sql`
  SELECT id, name, brand, socket, supported_ram_types FROM components
  WHERE category = 'motherboard' AND is_active = true
    AND (socket IS NULL OR socket = '' OR supported_ram_types IS NULL)
  ORDER BY id DESC LIMIT 20
` as { id: number; name: string; brand: string; socket: string; supported_ram_types: string[] }[];

if (mbBad.length === 0) ok('All motherboards have socket and RAM types');
else mbBad.forEach(c => fail(`[${c.id}] ${c.brand} ${c.name} — socket=${c.socket}`));

// ── 5. Sample newly created entries ──────────────────────────────────────────
console.log('\n=== Sample of recently created components (last 20) ===');
const recent = await sql`
  SELECT id, category, brand, name, socket, ram_type, frequency_mhz, length_mm, wattage
  FROM components
  WHERE is_active = true
  ORDER BY id DESC
  LIMIT 20
` as any[];

for (const c of recent) {
  const detail = c.socket ?? c.ram_type ?? (c.frequency_mhz ? `${c.frequency_mhz}MHz` : '') ??
    (c.length_mm ? `${c.length_mm}mm` : '') ?? (c.wattage ? `${c.wattage}W` : '');
  console.log(`  [${c.id}] ${c.category.padEnd(12)} ${(c.brand ?? '').padEnd(12)} ${c.name} ${detail ? `(${detail})` : ''}`);
}

// ── 6. Check for obviously wrong categories ───────────────────────────────────
console.log('\n=== Potential category mismatches ===');

// CPUs that look like motherboards
const cpuLooksMb = await sql`
  SELECT id, name, brand FROM components
  WHERE category = 'cpu' AND is_active = true
    AND (name ILIKE '%carte%' OR name ILIKE '%motherboard%' OR name ILIKE '%socket%'
         OR name ~ '[ABXHZ][0-9]{3,4}')
  ORDER BY id DESC LIMIT 10
` as { id: number; name: string; brand: string }[];
if (cpuLooksMb.length > 0) cpuLooksMb.forEach(c => fail(`[${c.id}] Looks like MB but in cpu: ${c.brand} ${c.name}`));

// GPUs that look like CPUs
const gpuLooksCpu = await sql`
  SELECT id, name, brand FROM components
  WHERE category = 'gpu' AND is_active = true
    AND (name ILIKE '%ryzen%' OR name ILIKE '%core i%' OR name ILIKE '%threadripper%')
  ORDER BY id DESC LIMIT 10
` as { id: number; name: string; brand: string }[];
if (gpuLooksCpu.length > 0) gpuLooksCpu.forEach(c => fail(`[${c.id}] Looks like CPU but in gpu: ${c.brand} ${c.name}`));

// Storage that looks like RAM
const storLooksRam = await sql`
  SELECT id, name, brand FROM components
  WHERE category = 'storage' AND is_active = true
    AND (name ILIKE '%ddr4%' OR name ILIKE '%ddr5%' OR name ILIKE '%dimm%')
  ORDER BY id DESC LIMIT 10
` as { id: number; name: string; brand: string }[];
if (storLooksRam.length > 0) storLooksRam.forEach(c => fail(`[${c.id}] Looks like RAM but in storage: ${c.brand} ${c.name}`));

if (cpuLooksMb.length === 0 && gpuLooksCpu.length === 0 && storLooksRam.length === 0) {
  ok('No obvious category mismatches found');
}

// ── 7. Duplicate detection ────────────────────────────────────────────────────
console.log('\n=== Potential duplicates (same brand+name, different id) ===');
const dupes = await sql`
  SELECT brand, name, COUNT(*) as cnt, array_agg(id ORDER BY id) as ids
  FROM components
  WHERE is_active = true
  GROUP BY brand, name
  HAVING COUNT(*) > 1
  ORDER BY cnt DESC
  LIMIT 15
` as { brand: string; name: string; cnt: number; ids: number[] }[];

if (dupes.length === 0) ok('No exact name duplicates');
else dupes.forEach(d => fail(`"${d.brand} ${d.name}" appears ${d.cnt}x — ids: ${d.ids.join(', ')}`));

// ── 8. Mappings pointing to wrong category ────────────────────────────────────
console.log('\n=== Sample mappings: scraped name vs catalog entry ===');
const mappingSample = await sql`
  SELECT
    sm.product_identifier AS scraped,
    c.category,
    c.brand,
    c.name AS catalog_name
  FROM scraper_mappings sm
  JOIN components c ON c.id = sm.component_id
  WHERE sm.product_identifier IS NOT NULL
    AND sm.product_identifier != ''
  ORDER BY sm.id DESC
  LIMIT 20
` as { scraped: string; category: string; brand: string; catalog_name: string }[];

for (const m of mappingSample) {
  console.log(`  [${m.category}] "${m.scraped.slice(0, 60)}" → ${m.brand} ${m.catalog_name}`);
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n=== Summary: ${issues} issue(s) found ===`);
if (issues === 0) console.log('All checks passed.');

process.exit(issues > 0 ? 1 : 0);
