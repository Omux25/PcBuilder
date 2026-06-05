import type { SqlFn } from '../../../../core/db/index.js';
import type { TaskResult } from '../curationEngine.js';
import { cleanName } from '@shared/hardware/cleaning';

export async function recleanCases(sql: SqlFn): Promise<TaskResult> {
  const cases = await sql`
    SELECT id, name, brand, category
    FROM components
    WHERE category = 'case'
  ` as any[];

  let updated = 0;
  for (const c of cases) {
    const originalName = c.name;
    const newName = cleanName(originalName, c.brand, 'case');

    if (newName !== originalName) {
      await sql`UPDATE components SET name = ${newName}, updated_at = NOW() WHERE id = ${c.id}`;
      updated++;
    }
  }

  return {
    success: true,
    mutatedCount: updated,
    message: `Cleaned and normalized ${updated} case name(s).`
  };
}
