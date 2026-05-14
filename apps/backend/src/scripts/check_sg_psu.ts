
import { getSql } from '../core/db/index.js';

async function checkSgPsus() {
  const sql = getSql();
  
  const psus = await sql`
    SELECT id, name, brand, category, wattage
    FROM components
    WHERE brand = 'Setup Game' AND category = 'psu'
  ` as any[];

  console.log(`--- SETUP GAME PSUS (${psus.length}) ---`);
  psus.forEach(p => {
    console.log(`- [${p.id}] ${p.brand} | ${p.name} (${p.wattage}W)`);
  });
}

checkSgPsus().catch(console.error);
