import { getSql } from '../../src/core/db/index.js';
const sql = getSql();

console.log('Cleaning up SortingTestRetailer and SortingBrand components...');

await sql`DELETE FROM prices WHERE component_id IN (SELECT id FROM components WHERE brand = 'SortingBrand')`;
await sql`DELETE FROM components WHERE brand = 'SortingBrand'`;
await sql`DELETE FROM retailers WHERE name = 'SortingTestRetailer'`;

console.log('✅ Cleaned up successfully.');
