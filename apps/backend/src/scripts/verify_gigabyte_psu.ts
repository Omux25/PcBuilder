import { getSql } from '../core/db/index.js';

async function main() {
  const sql = getSql();
  
  const ids = [5675, 5677];
  for (const id of ids) {
    const comp = await sql`SELECT id, name, brand, efficiency_rating, modular FROM components WHERE id = ${id}` as any[];
    const prices = await sql`SELECT product_url, price FROM prices WHERE component_id = ${id}` as any[];
    console.log(`\nComponent ID ${id}:`);
    console.log(comp[0]);
    console.log('Prices / URLs:');
    console.log(prices);
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
