import { getSql } from '../apps/backend/src/core/db/index.js';

const sql = getSql();

async function run() {
  const rules = await sql`
    SELECT * 
    FROM keyword_rules
    WHERE keyword ~* 'v650|v750|sfx|aero|bronze'
  `;
  console.log(rules);
}

run().then(() => process.exit(0));
