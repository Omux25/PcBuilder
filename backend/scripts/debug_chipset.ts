import { sql } from 'bun';
const r = await sql`SELECT id, slug, name, brand, specs->>'chipset' as chipset FROM components WHERE id IN (579, 580, 597) ORDER BY id`;
for (const row of r as any[]) {
  console.log(row.id, row.brand, row.name, '| chipset:', row.chipset);
}
process.exit(0);
