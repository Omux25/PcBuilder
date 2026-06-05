import type { SqlFn } from '../../../../core/db/index.js';
import type { TaskResult } from '../curationEngine.js';

export async function fixStorageCapacities(sql: SqlFn): Promise<TaskResult> {
  const corrupted = await sql`
    SELECT id, name, brand, capacity_gb FROM components
    WHERE category = 'storage' AND capacity_gb >= 100000
  ` as { id: number, name: string, brand: string | null, capacity_gb: number }[];

  let updated = 0;

  for (const comp of corrupted) {
    const correctedCap = comp.capacity_gb / 1000;
    let newName = comp.name;
    const oldCapTB = comp.capacity_gb / 1000;
    
    const tbRegex = new RegExp(`\\b${oldCapTB}\\s*(?:TB|To)\\b`, 'gi');
    if (tbRegex.test(newName)) {
      if (correctedCap >= 1000) {
        newName = newName.replace(tbRegex, `${correctedCap / 1000}TB`);
      } else {
        newName = newName.replace(tbRegex, `${correctedCap}GB`);
      }
    } else {
      newName = newName.replace(/\b(\d+)\s*(?:TB|To)\b/gi, (match, valStr) => {
        const val = parseInt(valStr);
        if (val === oldCapTB) {
          return correctedCap >= 1000 ? `${correctedCap / 1000}TB` : `${correctedCap}GB`;
        }
        return match;
      });
    }

    await sql`
      UPDATE components
      SET capacity_gb = ${correctedCap}, name = ${newName}, updated_at = NOW()
      WHERE id = ${comp.id}
    `;
    updated++;
  }

  // MSI Datamag 20Gbps (ID 2523) capacity to 1000 GB
  const datamag = await sql`
    SELECT id, name, brand, capacity_gb FROM components WHERE id = 2523
  ` as { id: number, name: string, brand: string | null, capacity_gb: number | null }[];

  if (datamag.length > 0 && datamag[0].capacity_gb !== 1000) {
    await sql`
      UPDATE components
      SET capacity_gb = 1000, updated_at = NOW()
      WHERE id = 2523
    `;
    updated++;
  }

  return {
    success: true,
    mutatedCount: updated,
    message: `Fixed ${updated} corrupted storage capacity factors.`
  };
}
