import { getSql } from './src/core/db/index.js';
const sql = getSql();

console.log('--- DB Sort Test (Wattage DESC) ---');
const rows = await sql.unsafe(`
    SELECT name, wattage 
    FROM components 
    WHERE category = 'psu' AND wattage IS NOT NULL
    ORDER BY wattage DESC 
    LIMIT 5
`);
console.table(rows);

console.log('\n--- DB Sort Test (Price DESC) ---');
const prices = await sql.unsafe(`
    WITH p_list AS (
        SELECT component_id, MIN(price) as lp
        FROM prices
        GROUP BY component_id
    )
    SELECT c.name, p.lp
    FROM components c
    JOIN p_list p ON p.component_id = c.id
    WHERE c.category = 'psu'
    ORDER BY p.lp DESC
    LIMIT 5
`);
console.table(prices);

process.exit(0);
