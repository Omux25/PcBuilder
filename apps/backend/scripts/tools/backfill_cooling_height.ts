import { getSql } from '../../src/core/db/index.js';
const sql = getSql();

console.log('Backfilling cooling height_mm defaults...');

// Low profile air coolers
const lpRes = await sql`
  UPDATE components 
  SET height_mm = 37 
  WHERE category = 'cooling' 
    AND height_mm IS NULL 
    AND (name ~* 'low profile|slim|l9i|l9a|g200p|c7|m9i')
`;
console.log('Set 37mm height for low-profile air coolers.');

// AIO liquid coolers (pump block height)
const aioRes = await sql`
  UPDATE components 
  SET height_mm = 52 
  WHERE category = 'cooling' 
    AND height_mm IS NULL 
    AND (name ~* 'liquid|aio|water|ml\\d+|cooler.*master.*liquid|nexus|floe|kraken|h100|h115|h150|liquid\s*freezer')
`;
console.log('Set 52mm height for AIO liquid cooler blocks.');

// Standard Tower air coolers
const towerRes = await sql`
  UPDATE components 
  SET height_mm = 155 
  WHERE category = 'cooling' 
    AND height_mm IS NULL
`;
console.log('Set 155mm standard height for remaining air coolers.');

const check = await sql`
  SELECT height_mm IS NULL as is_missing, COUNT(*) 
  FROM components 
  WHERE category = 'cooling' 
  GROUP BY height_mm IS NULL
`;
console.table(check);
