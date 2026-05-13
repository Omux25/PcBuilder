import { sql } from 'bun';
const rows = await sql`SELECT id, name, brand, category FROM components WHERE category = 'psu' AND name ~* 'Elite'`;
console.log('--- "Elite" items in PSU category ---');
console.table(rows);

const casesWithElite = await sql`SELECT id, name, brand FROM components WHERE category = 'case' AND name ~* 'Elite'`;
console.log('\n--- "Elite" items in Case category ---');
console.table(casesWithElite);
