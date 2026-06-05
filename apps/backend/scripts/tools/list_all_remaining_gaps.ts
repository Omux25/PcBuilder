import { getSql } from '../../src/core/db/index.js';
const sql = getSql();

const categories = ['cpu', 'motherboard', 'gpu', 'ram', 'storage', 'psu', 'case', 'cooling', 'fan', 'thermal_paste'];

for (const cat of categories) {
  const missing = await sql`
    SELECT id, name, brand FROM components 
    WHERE category = ${cat} AND is_active = true 
      AND (
        (category = 'cpu' AND (socket IS NULL OR core_count IS NULL OR thread_count IS NULL)) OR
        (category = 'motherboard' AND (socket IS NULL OR form_factor IS NULL OR chipset IS NULL)) OR
        (category = 'gpu' AND (chipset IS NULL OR vram_gb IS NULL OR length_mm IS NULL)) OR
        (category = 'ram' AND (ram_type IS NULL OR frequency_mhz IS NULL OR capacity_gb IS NULL)) OR
        (category = 'storage' AND (interface_type IS NULL OR capacity_gb IS NULL)) OR
        (category = 'psu' AND (wattage IS NULL OR efficiency_rating IS NULL OR modular IS NULL)) OR
        (category = 'case' AND (max_gpu_length_mm IS NULL OR form_factor IS NULL)) OR
        (category = 'cooling' AND (height_mm IS NULL OR supported_sockets IS NULL OR max_tdp IS NULL))
      )
  ` as any[];
  
  if (missing.length > 0) {
    console.log(`=== ${cat.toUpperCase()} (${missing.length} missing specs) ===`);
    console.table(missing.slice(0, 10));
    if (missing.length > 10) console.log(`... and ${missing.length - 10} more`);
  }
}
