import { getSql } from '../core/db/index.js';

async function main() {
  const sql = getSql();
  console.log('🔍 Starting Storage Component State Verification...\n');

  // 1. Verify previously corrupted storage components
  const previouslyCorruptedIds = [2590, 2596, 2518, 2453, 2523];
  console.log('--- Checking Repaired Capacities ---');
  const repaired = await sql`
    SELECT id, name, brand, category, capacity_gb, interface_type FROM components
    WHERE id IN (2590, 2596, 2518, 2453, 2523)
  ` as { id: number, name: string, brand: string | null, category: string, capacity_gb: number | null, interface_type: string | null }[];

  for (const comp of repaired) {
    console.log(`ID: ${comp.id} | Name: "${comp.name}" | Brand: ${comp.brand} | Capacity: ${comp.capacity_gb} GB | Interface: ${comp.interface_type}`);
  }

  // 2. Verify some of the split storage components
  console.log('\n--- Checking Split Storage Components (SN850X and 990 Evo Plus) ---');
  const splitGroup = await sql`
    SELECT id, name, brand, capacity_gb, interface_type FROM components
    WHERE name ILIKE '%sn850x%' OR name ILIKE '%990 evo plus%' OR name ILIKE '%mp510%'
    ORDER BY name ASC, capacity_gb ASC
  ` as { id: number, name: string, brand: string | null, capacity_gb: number | null, interface_type: string | null }[];

  for (const comp of splitGroup) {
    console.log(`ID: ${comp.id} | Name: "${comp.name}" | Brand: ${comp.brand} | Capacity: ${comp.capacity_gb} GB | Interface: ${comp.interface_type}`);
  }

  console.log('\nVerification complete.');
}

main().catch(console.error);
