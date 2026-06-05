import { getSql } from '../../src/core/db/index.js';
const sql = getSql();

console.log('Backfilling case max_gpu_length_mm safe defaults...');

const atxRes = await sql`
  UPDATE components 
  SET max_gpu_length_mm = 360 
  WHERE category = 'case' 
    AND max_gpu_length_mm IS NULL 
    AND (form_factor = 'ATX' OR form_factor = 'Full Tower' OR form_factor = 'E-ATX')
`;
console.log('Set 360mm GPU limit for ATX and Full Tower cases.');

const matxRes = await sql`
  UPDATE components 
  SET max_gpu_length_mm = 330 
  WHERE category = 'case' 
    AND max_gpu_length_mm IS NULL 
    AND form_factor = 'mATX'
`;
console.log('Set 330mm GPU limit for mATX cases.');

const itxRes = await sql`
  UPDATE components 
  SET max_gpu_length_mm = 310 
  WHERE category = 'case' 
    AND max_gpu_length_mm IS NULL 
    AND form_factor = 'Mini-ITX'
`;
console.log('Set 310mm GPU limit for Mini-ITX cases.');

const check = await sql`
  SELECT form_factor, COUNT(*) 
  FROM components 
  WHERE category = 'case' AND max_gpu_length_mm IS NULL 
  GROUP BY form_factor
`;
console.log('Remaining missing GPU clearances:');
console.table(check);
