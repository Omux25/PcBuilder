import { getSql } from '../../src/core/db/index.js';
const sql = getSql();
const rows = await sql`SELECT DISTINCT interface_type, COUNT(*) FROM components WHERE category = 'storage' GROUP BY interface_type`;
console.table(rows);
