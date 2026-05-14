
import { getSql } from '../core/db/index.js';

async function verifyState() {
  const sql = getSql();
  const ids = [628, 729, 730, 560, 558, 557, 142, 143, 3924, 3003];
  
  const results = await sql`
    SELECT id, name, brand, category
    FROM components
    WHERE id IN (628, 729, 730, 560, 558, 557, 142, 143, 3924, 3003)
  ` as any[];

  console.log('--- VERIFICATION ---');
  results.forEach(r => {
    console.log(`[ID ${r.id}] ${r.brand} | ${r.name} -> ${r.category}`);
  });
}

verifyState().catch(console.error);
