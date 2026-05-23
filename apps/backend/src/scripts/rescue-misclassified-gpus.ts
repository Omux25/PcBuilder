/**
 * rescue-misclassified-gpus.ts
 *
 * Step 2 of the GPU/RAM pollution remediation:
 *  1. Identify components stuck in category='ram' that have GPU signature keywords in their name.
 *  2. Reclassify them to category='gpu'.
 *  3. Clear all fake RAM specs (memory_type, capacity_gb, latency/cas_latency, kit_count,
 *     ram_type, frequency_mhz).
 *  4. Backfill real GPU specs (chipset, vram_gb, tdp, length_mm) via the local
 *     extractGpuSpecs utility — same logic the ingestion pipeline uses.
 *
 * Run with:  bun run apps/backend/src/scripts/rescue-misclassified-gpus.ts
 */

import { sql } from 'bun';
import { extractGpuSpecs } from '@shared/hardware/specs/gpu';

// ── GPU signature patterns — mirrors inferCategory() guard in categories.ts ──
const GPU_SIGNATURE_CLAUSES = `
  name ILIKE '%vga%'
  OR name ILIKE '%gtx%'
  OR name ILIKE '%rtx%'
  OR name ILIKE '%geforce%'
  OR name ILIKE '%radeon%'
  OR name ILIKE '%carte graphique%'
  OR name ILIKE '%gpu%'
  OR name ~* '\\mrx\\s*[0-9]{3,4}\\M'
  OR name ~* '\\bgt\\s+[0-9]{3,4}\\b'
  OR name ~* '\\barc\\s+[ab][0-9]{3}\\b'
`;

async function run() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  GPU Rescue Operation — Misclassified GPUs in RAM Category');
  console.log('═══════════════════════════════════════════════════════════\n');

  // ── Step 1: Identify the victims ──────────────────────────────────────────
  const misclassified = await sql.unsafe(`
    SELECT id, name, brand, slug, category,
           ram_type, frequency_mhz, capacity_gb, cas_latency, kit_count
    FROM components
    WHERE category = 'ram'
      AND (${GPU_SIGNATURE_CLAUSES})
    ORDER BY name ASC
  `) as {
    id: number;
    name: string;
    brand: string | null;
    slug: string;
    category: string;
    ram_type: string | null;
    frequency_mhz: number | null;
    capacity_gb: number | null;
    cas_latency: string | null;
    kit_count: number | null;
  }[];

  console.log(`🔍 Found ${misclassified.length} GPU(s) misclassified as RAM:\n`);

  if (misclassified.length === 0) {
    console.log('✅ No misclassified GPUs found. The database is clean!');
    process.exit(0);
  }

  for (const item of misclassified) {
    const fakeSpecs = [item.ram_type, item.frequency_mhz, item.capacity_gb].filter(Boolean);
    console.log(`  [${item.id}] "${item.brand ? item.brand + ' ' : ''}${item.name}"`);
    if (fakeSpecs.length > 0) {
      console.log(`       ↳ Fake RAM specs: ram_type=${item.ram_type ?? 'null'}, ${item.frequency_mhz ?? 'null'} MHz, ${item.capacity_gb ?? 'null'} GB`);
    }
  }

  // ── Step 2 + 3 + 4: Reclassify, purge fake RAM specs, backfill GPU specs ─
  console.log('\n🔧 Reclassifying and backfilling GPU specs...\n');

  let rescued = 0;
  let specsFilled = 0;
  let specsMissing = 0;

  await sql.begin(async (tx) => {
    for (const item of misclassified) {
      const fullName = item.brand ? `${item.brand} ${item.name}` : item.name;
      const gpuSpecs = extractGpuSpecs(fullName);

      const specsPayload = {
        chipset: gpuSpecs.chipset ?? null,
        vram_gb: gpuSpecs.vram_gb ?? null,
        tdp: gpuSpecs.tdp ?? null,
        length_mm: gpuSpecs.length_mm ?? null,
      };

      const hasSpecs = gpuSpecs.chipset || gpuSpecs.vram_gb;

      await tx.unsafe(`
        UPDATE components
        SET
          category        = 'gpu',
          -- Clear fake RAM columns
          ram_type        = NULL,
          frequency_mhz   = NULL,
          capacity_gb     = NULL,
          cas_latency     = NULL,
          kit_count       = 1,
          -- Backfill real GPU columns
          chipset         = $1,
          vram_gb         = $2,
          tdp             = $3,
          length_mm       = $4,
          specs           = $5,
          updated_at      = NOW()
        WHERE id = $6
      `, [
        specsPayload.chipset,
        specsPayload.vram_gb,
        specsPayload.tdp,
        specsPayload.length_mm,
        JSON.stringify(specsPayload),
        item.id,
      ]);

      if (hasSpecs) {
        console.log(`  ✅ [${item.id}] "${fullName}" → gpu | chipset=${gpuSpecs.chipset ?? '?'}, vram=${gpuSpecs.vram_gb ?? '?'} GB, tdp=${gpuSpecs.tdp ?? '?'} W`);
        specsFilled++;
      } else {
        console.log(`  ⚠️  [${item.id}] "${fullName}" → gpu | specs could not be extracted — flagged for manual review`);
        specsMissing++;
      }

      rescued++;
    }
  });

  // ── Step 5: Report ────────────────────────────────────────────────────────
  console.log('\n══════════════════════ RESCUE COMPLETE ══════════════════════');
  console.log(`  🚀 Total GPUs rescued from RAM category : ${rescued}`);
  console.log(`  ✅ Specs fully backfilled                : ${specsFilled}`);
  console.log(`  ⚠️  Specs need manual review             : ${specsMissing}`);
  console.log('══════════════════════════════════════════════════════════════\n');

  if (specsMissing > 0) {
    console.log('Run "bun run apps/backend/src/scripts/run-enrichment.ts" to attempt');
    console.log('deep enrichment for any GPUs that still have null chipset/vram.\n');
  }
}

run().catch((err) => {
  console.error('❌ Rescue script failed:', err);
  process.exit(1);
}).finally(() => process.exit(0));
