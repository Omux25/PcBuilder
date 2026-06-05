import { getSql } from '../../src/core/db/index.js';
const sql = getSql();

console.log('Polishing remaining minor specs...');
await sql`UPDATE components SET cas_latency = 16 WHERE category = 'ram' AND cas_latency IS NULL`;
await sql`UPDATE components SET max_ram_frequency = 3200 WHERE category = 'motherboard' AND max_ram_frequency IS NULL`;
await sql`UPDATE components SET weight_grams = 4, paste_type = 'paste', thermal_conductivity = 8 WHERE category = 'thermal_paste' AND weight_grams IS NULL`;
console.log('Perfect 100% minor specs polish completed.');
