import { sql } from 'bun';
const rows = await sql`SELECT id, name, brand, category FROM components WHERE category = 'case' ORDER BY id DESC LIMIT 100`;
console.table(rows);
