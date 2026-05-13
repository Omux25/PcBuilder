import { sql } from 'bun';

const categories = [
  'cpu', 'motherboard', 'gpu', 'ram', 'storage', 'psu', 'case', 'cooling', 'fan', 'thermal_paste'
];

console.log('Detailed Specification Coverage Analysis\n');

for (const cat of categories) {
  const total = await sql`SELECT COUNT(*)::int AS cnt FROM components WHERE category = ${cat} AND is_active = true` as { cnt: number }[];
  const count = total[0].cnt;
  
  if (count === 0) {
    console.log(`[${cat}] No active components found.`);
    continue;
  }

  console.log(`[${cat.toUpperCase()}] Total: ${count}`);

  const fields: Record<string, string[]> = {
    cpu: ['socket', 'tdp', 'core_count', 'thread_count', 'base_clock_ghz', 'boost_clock_ghz'],
    motherboard: ['socket', 'form_factor', 'supported_ram_types', 'max_ram_frequency', 'ram_slots', 'm2_slots', 'chipset'],
    gpu: ['length_mm', 'tdp', 'vram_gb', 'chipset'],
    ram: ['ram_type', 'frequency_mhz', 'kit_count', 'cas_latency', 'capacity_gb'],
    storage: ['interface_type', 'capacity_gb', 'read_speed_mbps', 'write_speed_mbps'],
    psu: ['wattage', 'efficiency_rating', 'modular'],
    case: ['max_gpu_length_mm', 'max_cooler_height_mm', 'supported_motherboards', 'form_factor'],
    cooling: ['height_mm', 'supported_sockets', 'max_tdp'],
    fan: ['size_mm', 'airflow_cfm', 'noise_db', 'rgb', 'pack_size'],
    thermal_paste: ['weight_grams', 'thermal_conductivity', 'paste_type']
  };

  const relevantFields = fields[cat] || [];
  
  for (const field of relevantFields) {
    let missing;
    if (field === 'supported_ram_types' || field === 'supported_motherboards' || field === 'supported_sockets') {
        missing = await sql.unsafe(`SELECT COUNT(*)::int AS cnt FROM components WHERE category = $1 AND is_active = true AND (${field} IS NULL OR array_length(${field}, 1) IS NULL)`, [cat]) as { cnt: number }[];
    } else {
        missing = await sql.unsafe(`SELECT COUNT(*)::int AS cnt FROM components WHERE category = $1 AND is_active = true AND (${field} IS NULL OR ${field}::text = '' OR ${field}::text = '0')`, [cat]) as { cnt: number }[];
    }
    const mCount = missing[0].cnt;
    const coverage = ((count - mCount) / count * 100).toFixed(1);
    console.log(`  - ${field.padEnd(25)}: ${mCount.toString().padStart(4)} missing (${coverage}% coverage)`);
  }
  
  const conditions = relevantFields.map(f => `${f} IS NULL`).join(' AND ');
  const allNull = await sql.unsafe(`
    SELECT COUNT(*)::int AS cnt FROM components 
    WHERE category = $1 AND is_active = true 
    AND (${conditions})
  `, [cat]) as { cnt: number }[];
  
  if (relevantFields.length > 0) {
    console.log(`  - COMPONENT WITH NO SPECS AT ALL: ${allNull[0].cnt} (${(allNull[0].cnt / count * 100).toFixed(1)}%)`);
  }
  
  console.log('');
}
