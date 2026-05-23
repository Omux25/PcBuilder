import { getSql } from '../apps/backend/src/core/db/index.js';

async function queryDetails() {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM components WHERE id IN (2590, 2550, 2596)
  `;
  console.log(JSON.stringify(rows, null, 2));
}

queryDetails().catch(console.error);
