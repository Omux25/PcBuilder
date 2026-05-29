
/**
 * refresh_metadata.ts
 * Retroactively populates missing brand labels and dedicated spec columns for all components
 * by running each category's extractor against the product name.
 *
 * Run: bun run src/scripts/refresh_metadata.ts
 */
import { getSql } from '../core/db/index.js';
import { extractBrand } from '@shared/hardware/brands';
import { extractCaseSpecs } from '@shared/hardware/specs/case';
import { extractCoolingSpecs } from '@shared/hardware/specs/cooling';
import { extractPsuSpecs } from '@shared/hardware/specs/psu';
import { extractRamSpecs } from '@shared/hardware/specs/ram';
import { extractStorageSpecs } from '@shared/hardware/specs/storage';

async function refreshMetadata() {
  const sql = getSql();
  const components = (await sql`SELECT id, name, category, brand, supported_motherboards, max_gpu_length_mm, max_cooler_height_mm, wattage, capacity_gb, interface_type, ram_type, frequency_mhz, kit_count, cas_latency, mpn, efficiency_rating, modular, tdp, height_mm, tags FROM components`) as {
    id: number;
    name: string;
    category: string;
    brand: string | null;
    supported_motherboards: string[] | null;
    max_gpu_length_mm: number | null;
    max_cooler_height_mm: number | null;
    wattage: number | null;
    capacity_gb: number | null;
    interface_type: string | null;
    ram_type: string | null;
    frequency_mhz: number | null;
    kit_count: number | null;
    cas_latency: number | null;
    mpn: string | null;
    efficiency_rating: string | null;
    modular: string | null;
    tdp: number | null;
    height_mm: number | null;
    tags: string[] | null;
  }[];

  let brandUpdates = 0;
  let specUpdates = 0;
  let skipped = 0;

  for (const c of components) {
    const updates: Record<string, unknown> = {};

    // 1. Fill missing brand
    if (!c.brand?.trim()) {
      const detected = extractBrand(c.name);
      if (detected) {
        updates.brand = detected;
        brandUpdates++;
      }
    }

    // 2. Apply category-specific extractor → write to REAL COLUMNS
    if (c.category === 'case') {
      const ex = extractCaseSpecs(c.name);
      if (ex.supported_motherboards && !c.supported_motherboards?.length) {
        updates.supported_motherboards = ex.supported_motherboards;
      }
      if (ex.max_gpu_length_mm && !c.max_gpu_length_mm) {
        updates.max_gpu_length_mm = ex.max_gpu_length_mm;
      }
      if (ex.max_cooler_height_mm && !c.max_cooler_height_mm) {
        updates.max_cooler_height_mm = ex.max_cooler_height_mm;
      }

    } else if (c.category === 'psu') {
      const ex = extractPsuSpecs(c.name);
      if (ex.wattage && !c.wattage) updates.wattage = ex.wattage;

    } else if (c.category === 'storage') {
      const ex = extractStorageSpecs(c.name);
      if (ex.capacity_gb && !c.capacity_gb) updates.capacity_gb = ex.capacity_gb;
      if (ex.interface_type && !c.interface_type) updates.interface_type = ex.interface_type;

    } else if (c.category === 'ram') {
      const ex = extractRamSpecs(c.name);
      if (ex.ram_type && !c.ram_type) updates.ram_type = ex.ram_type;
      if (ex.frequency_mhz && !c.frequency_mhz) updates.frequency_mhz = ex.frequency_mhz;
      if (ex.capacity_gb && !c.capacity_gb) updates.capacity_gb = ex.capacity_gb;
      if (ex.kit_count && !c.kit_count) updates.kit_count = ex.kit_count;
      if (ex.cas_latency && !c.cas_latency) updates.cas_latency = ex.cas_latency;
      if (ex.mpn && !c.mpn) updates.mpn = ex.mpn;

    } else if (c.category === 'cooling') {
      const ex = extractCoolingSpecs(c.name, c.brand ?? undefined);
      if (ex.tdp && !c.tdp) updates.tdp = ex.tdp;
      if (ex.height_mm && !c.height_mm) updates.height_mm = ex.height_mm;
      if (ex.tags && ex.tags.length > 0) {
        const existingTags = c.tags || [];
        const newTags = [...new Set([...existingTags, ...ex.tags])];
        if (newTags.length > existingTags.length) {
          updates.tags = newTags;
        }
      }
    } else {
      skipped++;
      continue;
    }

    if (Object.keys(updates).length > 0) {
      if (Object.keys(updates).length > (updates.brand ? 1 : 0)) specUpdates++;

      for (const [col, val] of Object.entries(updates)) {
        if (col === 'supported_motherboards' && Array.isArray(val)) {
          // Use raw Postgres array literal to avoid double-quoting
          const pgArray = '{' + (val as string[]).join(',') + '}';
          await sql`UPDATE components SET supported_motherboards = ${pgArray}::text[] WHERE id = ${c.id}`;
        } else if (col === 'tags' && Array.isArray(val)) {
          const pgArray = '{' + (val as string[]).join(',') + '}';
          await sql`UPDATE components SET tags = ${pgArray}::text[] WHERE id = ${c.id}`;
        } else {
          await sql`UPDATE components SET ${sql(col)} = ${val as string | number | null} WHERE id = ${c.id}`;
        }
      }
    }
  }

  console.log(`✅ Metadata refresh complete.`);
  console.log(`   Total processed:  ${components.length}`);
  console.log(`   Brand updates:    ${brandUpdates}`);
  console.log(`   Spec updates:     ${specUpdates}`);
  console.log(`   Skipped:          ${skipped} (no extractor for category)`);
  process.exit(0);
}

refreshMetadata().catch(e => { console.error(e); process.exit(1); });
