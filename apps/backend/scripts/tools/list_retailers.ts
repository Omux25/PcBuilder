import { getSql } from '../../src/core/db/index.js';
const sql = getSql();
const rows = await sql`SELECT * FROM retailers`;
console.table(rows);
