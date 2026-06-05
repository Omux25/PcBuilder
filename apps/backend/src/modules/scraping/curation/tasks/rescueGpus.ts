import type { SqlFn } from '../../../../core/db/index.js';
import type { TaskResult } from '../curationEngine.js';
import { extractGpuSpecs } from '@shared/hardware/specs/gpu';

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

export async function rescueGpus(sql: SqlFn): Promise<TaskResult> {
  const misclassified = await sql.unsafe(`
    SELECT id, name, brand, slug, category
    FROM components
    WHERE category = 'ram'
      AND (${GPU_SIGNATURE_CLAUSES})
  `) as { id: number; name: string; brand: string | null; slug: string; category: string }[];

  if (misclassified.length === 0) {
    return {
      success: true,
      mutatedCount: 0,
      message: 'No misclassified GPUs found in RAM category.'
    };
  }

  let rescued = 0;

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

      await tx.unsafe(`
        UPDATE components
        SET
          category        = 'gpu',
          ram_type        = NULL,
          frequency_mhz   = NULL,
          capacity_gb     = NULL,
          cas_latency     = NULL,
          kit_count       = 1,
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

      rescued++;
    }
  });

  return {
    success: true,
    mutatedCount: rescued,
    message: `Rescued ${rescued} GPU(s) misclassified as RAM.`
  };
}
