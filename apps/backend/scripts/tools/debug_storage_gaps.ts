import { sql } from 'bun';
const rows = await sql`SELECT id, name, brand FROM components WHERE category = 'storage' AND (interface_type IS NULL OR capacity_gb IS NULL)`;
console.table(rows);
