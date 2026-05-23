import { getSql } from '../apps/backend/src/core/db/index.js';

async function check() {
  const sql = getSql();
  const rows = await sql`
    SELECT id, name, brand, capacity_gb, interface_type, slug 
    FROM components 
    WHERE category = 'storage' AND capacity_gb > 8000
    ORDER BY capacity_gb DESC
  `;
  console.log('Suspicious capacities:', rows);
}

check().catch(console.error);
