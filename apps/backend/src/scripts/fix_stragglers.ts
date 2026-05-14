
import { getSql } from '../core/db/index.js';

async function fixStragglers() {
  const sql = getSql();
  console.log('--- FIXING LINGERING CATEGORY POLLUTION ---');

  // Fix Cougar Coolers/Fans
  await sql`UPDATE components SET category = 'cooling' WHERE brand = 'Cougar' AND name ILIKE '%Aqua%' AND category = 'case'`;
  await sql`UPDATE components SET category = 'fan' WHERE brand = 'Cougar' AND (name ILIKE '%Fan%' OR name ILIKE '%Ventilateur%') AND category = 'case'`;

  // Fix Hybrok PSUs/Coolers/Fans
  await sql`UPDATE components SET category = 'psu' WHERE brand = 'Hybrok' AND name = '80+' AND category = 'case'`;
  await sql`UPDATE components SET category = 'cooling' WHERE brand = 'Hybrok' AND (name ILIKE '%Hl240%' OR name ILIKE '%Hl360%') AND category = 'case'`;
  // If it's just "Carbon 4 Fan ARGB" it's probably a case, but if it has no case keywords and is clearly a fan pack, wait. Cases usually have the brand. Let's leave Hybrok cases alone for now unless we are sure. "Carbon ARGB", "Hacker ARGB" are cases. "Volcano ARGB" is a case. 

  // Fix Setup Game SG normalization
  // We'll update the DB to change brand "SG" to "Setup Game" globally.
  await sql`UPDATE components SET brand = 'Setup Game' WHERE brand = 'SG'`;
  
  // Also strip "Sg" or "Sg " from the beginning of Setup Game component names.
  const setupGameItems = await sql`SELECT id, name FROM components WHERE brand = 'Setup Game' AND name ILIKE 'Sg %'`;
  for (const item of setupGameItems) {
    const newName = item.name.replace(/^Sg\s+/i, '').trim();
    await sql`UPDATE components SET name = ${newName} WHERE id = ${item.id}`;
  }
  
  const setupGameItems2 = await sql`SELECT id, name FROM components WHERE brand = 'Setup Game' AND name ILIKE '% Setup Game%'`;
  for (const item of setupGameItems2) {
    const newName = item.name.replace(/Setup Game/gi, '').replace(/\s+/g, ' ').trim();
    await sql`UPDATE components SET name = ${newName} WHERE id = ${item.id}`;
  }

  console.log('Fixed stragglers and normalized Setup Game naming.');
}

fixStragglers().catch(console.error);
