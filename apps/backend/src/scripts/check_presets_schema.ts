
import { getSql } from '../core/db/index.js';

async function check() {
  const sql = getSql();
  const cols = await sql`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'preset_builds'
  `;
  console.log('preset_builds columns:', cols.map((c: any) => c.column_name).join(', '));
  process.exit(0);
}

check();
