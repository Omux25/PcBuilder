import { sql } from 'bun';

const rows = await sql`
    SELECT id, name, category 
    FROM components 
    WHERE category = 'psu' 
      AND (name ~* 'liquid|water|aio|cooler|boitier|tower|chassis|refroidisseur|ventilateur|case')
`;

console.log('--- Potential Intruders in PSU Category ---');
console.table(rows);
process.exit(0);
