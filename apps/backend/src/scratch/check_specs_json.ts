import { sql } from 'bun';

const mbs = await sql`
  SELECT id, name, brand, specs, ram_slots
  FROM components
  WHERE category = 'motherboard' AND is_active = true
  LIMIT 20
`;

for (const mb of mbs) {
  console.log(`- ${mb.brand} ${mb.name}: ram_slots = ${mb.ram_slots}, specs = ${JSON.stringify(mb.specs)}`);
}
process.exit(0);
