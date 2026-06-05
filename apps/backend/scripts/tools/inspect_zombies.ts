import { getSql } from '../../src/core/db/index.js';
const sql = getSql();

console.log('=== Active CPUs missing Core Count ===');
const cpus = await sql`SELECT id, name, brand FROM components WHERE category = 'cpu' AND is_active = true AND core_count IS NULL`;
console.table(cpus);

console.log('=== Active GPUs missing Length ===');
const gpus = await sql`SELECT id, name, brand FROM components WHERE category = 'gpu' AND is_active = true AND length_mm IS NULL`;
console.table(gpus);

console.log('=== Active Cases missing Motherboards ===');
const cases = await sql`SELECT id, name, brand FROM components WHERE category = 'case' AND is_active = true AND form_factor IS NULL`;
console.table(cases);
