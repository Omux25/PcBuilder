import { sql } from 'bun';
const mb = await sql`SELECT name FROM components WHERE category = 'motherboard' AND socket IS NULL LIMIT 20`;
console.log('--- Motherboards with NULL socket ---');
console.log(mb.map(r => r.name).join('\n'));

const st = await sql`SELECT name FROM components WHERE category = 'storage' AND read_speed_mbps IS NULL LIMIT 20`;
console.log('\n--- Storage with NULL read speed ---');
console.log(st.map(r => r.name).join('\n'));
