import { getSql } from './src/core/db/index';
const sql = getSql();

async function run() {
  const ids = [4058, 4243, 719, 367, 721];
  const res = await sql`SELECT id, name, category FROM components WHERE id = ANY(${ids})`;
  console.log(res);
  process.exit();
}

run();
