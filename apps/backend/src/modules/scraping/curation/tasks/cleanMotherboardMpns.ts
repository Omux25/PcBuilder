import type { SqlFn } from '../../../../core/db/index.js';
import type { TaskResult } from '../curationEngine.js';

export async function cleanMotherboardMpns(sql: SqlFn): Promise<TaskResult> {
  const FORBIDDEN_MPNS = [
    'BIOSTAR', 'ASROCK', 'TORPEDO', 'TOMAHAWK', 'STRIX', 'GIGABYTE', 'PRIME', 'AORUS', 'GAMING', 'CARTE', 'SOCKET', 'MAXIMUS',
    'B550M', 'B660M', 'Z690M', 'B560M', 'B650M', 'H510M-A'
  ];

  // 1. Invalidate generic motherboard MPNs
  const result = await sql`
    UPDATE components
    SET mpn = NULL, updated_at = NOW()
    WHERE category = 'motherboard'
      AND UPPER(TRIM(mpn)) IN ${sql(FORBIDDEN_MPNS)}
    RETURNING id
  ` as { id: number }[];

  // 2. Invalidate duplicate barcode from Gigabyte B650M Gaming Plus WiFi (keep it on MSI B650M Gaming Plus WiFi)
  const resultDupe = await sql`
    UPDATE components
    SET mpn = NULL, updated_at = NOW()
    WHERE id = 1060
    RETURNING id
  ` as { id: number }[];

  const mutated = result.length + resultDupe.length;
  return {
    success: true,
    mutatedCount: mutated,
    message: `Cleaned ${result.length} generic MPNs and ${resultDupe.length} duplicate collision(s).`
  };
}
