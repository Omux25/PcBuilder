import { sql } from 'bun';
const rows = await sql`SELECT name, brand FROM components WHERE category = 'cooling' LIMIT 20`;
console.log(rows.map((r: any) => `${r.brand} ${r.name}`).join('\n'));
