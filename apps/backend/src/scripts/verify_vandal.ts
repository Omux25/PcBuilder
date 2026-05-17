
import { getSql } from '../core/db/index.js';

const sql = getSql();
const r = await sql`
  SELECT id, brand, name, supported_motherboards, max_gpu_length_mm, max_cooler_height_mm
  FROM components
  WHERE name ILIKE '%Vandal%' OR name ILIKE '%Ares Ps195%' OR name ILIKE '%Wood Mini%'
`;
console.table(r);
process.exit(0);
