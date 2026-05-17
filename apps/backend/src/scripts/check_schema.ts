
import { getSql } from '../core/db/index.js';

async function checkSchema() {
  const sql = getSql();
  const columns = (await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'components';
  `) as { column_name: string }[];
  console.log("All components columns:", columns.map(c => c.column_name).join(', '));
}

checkSchema().catch(console.error);
