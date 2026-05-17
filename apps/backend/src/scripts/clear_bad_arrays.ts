
import { getSql } from '../core/db/index.js';

// Clear the double-quoted supported_motherboards values so refresh_metadata can refill them cleanly
const sql = getSql();
const result = await sql`
  UPDATE components
  SET supported_motherboards = NULL
  WHERE category = 'case'
  AND supported_motherboards IS NOT NULL
  AND array_to_string(supported_motherboards, ',') LIKE '%"%'
`;
console.log(`Cleared ${(result as any).count} incorrectly quoted rows.`);
process.exit(0);
