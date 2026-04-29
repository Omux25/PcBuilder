import { getSql } from '../../src/db/index.js';

async function main() {
  const sql = getSql();
  const mbs = await sql`SELECT id, brand, name, specs FROM components WHERE category='motherboard' LIMIT 5;`;
  console.log(JSON.stringify(mbs, null, 2));
  process.exit(0);
}
main();
