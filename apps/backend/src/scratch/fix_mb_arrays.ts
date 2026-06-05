import { sql } from 'bun';

console.log('🔧 Fixing motherboard RAM array quotes...\n');

// Clean up all escaped "DDR4" in supported_ram_types
const d4Rows = await sql`
  UPDATE components
  SET supported_ram_types = ARRAY['DDR4']
  WHERE category = 'motherboard'
    AND supported_ram_types IS NOT NULL
    AND (
      array_to_string(supported_ram_types, ',') LIKE '%"DDR4"%'
      OR array_to_string(supported_ram_types, ',') = 'DDR4'
    )
  RETURNING id
`;

// Clean up all escaped "DDR5" in supported_ram_types
const d5Rows = await sql`
  UPDATE components
  SET supported_ram_types = ARRAY['DDR5']
  WHERE category = 'motherboard'
    AND supported_ram_types IS NOT NULL
    AND (
      array_to_string(supported_ram_types, ',') LIKE '%"DDR5"%'
      OR array_to_string(supported_ram_types, ',') = 'DDR5'
    )
  RETURNING id
`;

console.log(`  Updated DDR4 arrays: ${d4Rows.length}`);
console.log(`  Updated DDR5 arrays: ${d5Rows.length}`);

process.exit(0);
