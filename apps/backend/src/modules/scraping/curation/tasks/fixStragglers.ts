import type { SqlFn } from '../../../../core/db/index.js';
import type { TaskResult } from '../curationEngine.js';

export async function fixStragglers(sql: SqlFn): Promise<TaskResult> {
  let updated = 0;

  // 1. Fix Cougar Coolers/Fans in Case category
  const res1 = await sql`UPDATE components SET category = 'cooling' WHERE brand = 'Cougar' AND name ILIKE '%Aqua%' AND category = 'case'`;
  const res2 = await sql`UPDATE components SET category = 'fan' WHERE brand = 'Cougar' AND (name ILIKE '%Fan%' OR name ILIKE '%Ventilateur%') AND category = 'case'`;
  updated += (res1 as any).count + (res2 as any).count;

  // 2. Fix Hybrok PSUs/Coolers in Case category
  const res3 = await sql`UPDATE components SET category = 'psu' WHERE brand = 'Hybrok' AND name = '80+' AND category = 'case'`;
  const res4 = await sql`UPDATE components SET category = 'cooling' WHERE brand = 'Hybrok' AND (name ILIKE '%Hl240%' OR name ILIKE '%Hl360%') AND category = 'case'`;
  updated += (res3 as any).count + (res4 as any).count;

  // 3. Fix Setup Game brand name globally
  const res5 = await sql`UPDATE components SET brand = 'Setup Game' WHERE brand = 'SG'`;
  updated += (res5 as any).count;
  
  // 4. Strip "Sg" or "Sg " from Setup Game names
  const setupGameItems = (await sql`SELECT id, name FROM components WHERE brand = 'Setup Game' AND name ILIKE 'Sg %'`) as { id: number; name: string }[];
  for (const item of setupGameItems) {
    const newName = item.name.replace(/^Sg\s+/i, '').trim();
    await sql`UPDATE components SET name = ${newName} WHERE id = ${item.id}`;
    updated++;
  }
  
  // 5. Strip redundant "Setup Game" from Setup Game names
  const setupGameItems2 = (await sql`SELECT id, name FROM components WHERE brand = 'Setup Game' AND name ILIKE '% Setup Game%'`) as { id: number; name: string }[];
  for (const item of setupGameItems2) {
    const newName = item.name.replace(/Setup Game/gi, '').replace(/\s+/g, ' ').trim();
    await sql`UPDATE components SET name = ${newName} WHERE id = ${item.id}`;
    updated++;
  }

  return {
    success: true,
    mutatedCount: updated,
    message: `Fixed ${updated} stragglers and normalized Setup Game naming.`
  };
}
