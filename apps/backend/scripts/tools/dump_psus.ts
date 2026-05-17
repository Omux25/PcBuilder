import { sql } from 'bun';
const rows = await sql`SELECT name, brand FROM components WHERE category = 'psu' ORDER BY name ASC`;
const text = rows.map((r: any) => `[${r.brand}] ${r.name}`).join('\n');
await Bun.write('psu_names.txt', text);
console.log(`Wrote ${rows.length} PSU names to psu_names.txt`);
process.exit(0);
