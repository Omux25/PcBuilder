import { sql } from 'bun';
const rows = await sql`SELECT id, name, brand, category FROM components WHERE category = 'psu' ORDER BY name ASC LIMIT 50`;
console.table(rows);
