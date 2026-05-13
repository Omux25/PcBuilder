import { sql } from 'bun';
const mb = await sql`SELECT name, brand FROM components WHERE category = 'motherboard' AND (chipset IS NULL OR m2_slots IS NULL)`;
console.log('--- Motherboards Missing Specs ---');
console.table(mb);

const ram = await sql`SELECT name, brand FROM components WHERE category = 'ram' AND ram_type IS NULL`;
console.log('\n--- RAM Missing Type ---');
console.table(ram);
