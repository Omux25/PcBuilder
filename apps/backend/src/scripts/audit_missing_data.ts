
import { getSql } from '../core/db/index.js';

const sql = getSql();

// Summary of missing data by category
const missing = await sql`
  SELECT 
    category,
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE brand IS NULL OR brand = '') AS missing_brand,
    COUNT(*) FILTER (WHERE specs IS NULL OR specs::text = '{}' OR specs::text = 'null') AS missing_specs
  FROM components
  GROUP BY category
  ORDER BY missing_brand DESC, missing_specs DESC
`;

console.log('\n=== Missing Data by Category ===');
console.table(missing);

// Total counts
const totals = await sql`
  SELECT
    COUNT(*) AS total_components,
    COUNT(*) FILTER (WHERE brand IS NULL OR brand = '') AS missing_brand,
    COUNT(*) FILTER (WHERE specs IS NULL OR specs::text = '{}') AS empty_specs
  FROM components
`;
console.log('\n=== Totals ===');
console.table(totals);

process.exit(0);
