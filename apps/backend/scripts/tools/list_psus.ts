import { sql } from 'bun';
const rows = await sql`SELECT id, name, brand, category FROM components WHERE category = 'psu' ORDER BY id DESC LIMIT 100`;
console.table(rows);
