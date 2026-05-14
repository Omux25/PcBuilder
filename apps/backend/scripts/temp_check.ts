import { getSql } from '../src/core/db/index.js';
async function main() {
  const sql = getSql();
  const res = await sql`SELECT id, name, brand, category FROM components WHERE id IN (145, 758, 229)`;
  console.table(res);
  process.exit(0);
}
main();
