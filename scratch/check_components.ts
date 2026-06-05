import { getSql } from '../apps/backend/src/core/db/index';

async function run() {
  const sql = getSql();
  
  const total = await sql`SELECT COUNT(*)::int AS cnt FROM components`;
  console.log("Total components in DB:", total[0].cnt);
  
  if (total[0].cnt > 0) {
    const cats = await sql`
      SELECT category, COUNT(*)::int AS cnt 
      FROM components 
      GROUP BY category
    `;
    console.log("Categories in components table:", cats);
  }
}

run().catch(console.error).then(() => process.exit(0));
