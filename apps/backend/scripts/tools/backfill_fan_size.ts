import { getSql } from '../../src/core/db/index.js';
const sql = getSql();

console.log('Backfilling fan size_mm values...');

const list = await sql`
  SELECT id, name FROM components 
  WHERE category = 'fan' AND size_mm IS NULL
` as { id: number; name: string }[];

let updated = 0;
for (const { id, name } of list) {
  const n = name.toLowerCase();
  let size = 120; // safe industry standard fallback

  if (/\b(140|14cm)\b/.test(n)) size = 140;
  else if (/\b(80|8cm)\b/.test(n)) size = 80;
  else if (/\b(92|9cm)\b/.test(n)) size = 92;
  else if (/\b(200|20cm)\b/.test(n)) size = 200;
  else if (/\b(120|12cm)\b/.test(n)) size = 120;

  await sql`UPDATE components SET size_mm = ${size} WHERE id = ${id}`;
  updated++;
}

console.log(`Updated ${updated} fans with size defaults.`);
