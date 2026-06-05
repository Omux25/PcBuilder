import { getSql } from '../../src/core/db/index.js';
const sql = getSql();

async function run() {
  console.log('🏁 Launching database specifications purge: Clearing all heuristic defaults...\n');

  // 1. Motherboards
  console.log('🔄 Clearing Motherboard defaults...');
  const mbReset = await sql`
    UPDATE components
    SET socket = CASE WHEN name ILIKE '%1700%' OR name ILIKE '%LGA%' THEN socket ELSE NULL END,
        chipset = CASE WHEN name ILIKE '%B760%' OR name ILIKE '%760%' THEN chipset ELSE NULL END,
        form_factor = CASE WHEN name ILIKE '%ATX%' OR name ILIKE '%Micro%' OR name ILIKE '%Mini%' THEN form_factor ELSE NULL END,
        ram_slots = NULL,
        m2_slots = NULL,
        supported_ram_types = NULL,
        max_ram_frequency = NULL,
        updated_at = NOW()
    WHERE category = 'motherboard' AND is_active = true
      AND (
        ram_slots = 4
        OR m2_slots = 2
        OR max_ram_frequency = 3200
        OR (socket = 'LGA1700' AND name NOT ILIKE '%1700%' AND name NOT ILIKE '%LGA%')
        OR (chipset = 'B760' AND name NOT ILIKE '%B760%' AND name NOT ILIKE '%760%')
      )
  `;
  console.log(`✅ Motherboard reset complete: ${mbReset.count ?? 0} rows reset to NULL.`);

  // 2. Cases
  console.log('🔄 Clearing Case defaults...');
  const caseReset = await sql`
    UPDATE components
    SET max_gpu_length_mm = CASE WHEN max_gpu_length_mm IN (360, 330, 310) THEN NULL ELSE max_gpu_length_mm END,
        max_cooler_height_mm = CASE WHEN max_cooler_height_mm IN (160, 155, 150) THEN NULL ELSE max_cooler_height_mm END,
        supported_motherboards = NULL,
        updated_at = NOW()
    WHERE category = 'case' AND is_active = true
      AND (
        max_gpu_length_mm IN (360, 330, 310)
        OR max_cooler_height_mm IN (160, 155, 150)
        OR supported_motherboards IS NOT NULL
      )
  `;
  console.log(`✅ Case reset complete: ${caseReset.count ?? 0} rows reset to NULL.`);

  // 3. Coolers (Cooling)
  console.log('🔄 Clearing Cooler defaults...');
  const coolingReset = await sql`
    UPDATE components
    SET height_mm = CASE WHEN height_mm = 155 THEN NULL ELSE height_mm END,
        max_tdp = CASE WHEN max_tdp IN (180, 200) THEN NULL ELSE max_tdp END,
        supported_sockets = NULL,
        updated_at = NOW()
    WHERE category = 'cooling' AND is_active = true
      AND (
        height_mm = 155
        OR max_tdp IN (180, 200)
        OR supported_sockets IS NOT NULL
      )
  `;
  console.log(`✅ Cooler reset complete: ${coolingReset.count ?? 0} rows reset to NULL.`);

  // 4. RAM
  console.log('🔄 Clearing RAM defaults...');
  const ramReset = await sql`
    UPDATE components
    SET cas_latency = CASE WHEN cas_latency = 16 THEN NULL ELSE cas_latency END,
        frequency_mhz = CASE WHEN frequency_mhz = 3200 THEN NULL ELSE frequency_mhz END,
        capacity_gb = CASE WHEN capacity_gb = 16 THEN NULL ELSE capacity_gb END,
        ram_type = CASE WHEN ram_type = 'DDR4' THEN NULL ELSE ram_type END,
        updated_at = NOW()
    WHERE category = 'ram' AND is_active = true
      AND (
        cas_latency = 16
        OR frequency_mhz = 3200
        OR capacity_gb = 16
        OR ram_type = 'DDR4'
      )
  `;
  console.log(`✅ RAM reset complete: ${ramReset.count ?? 0} rows reset to NULL.`);

  // 5. GPUs
  console.log('🔄 Clearing GPU defaults...');
  const gpuReset = await sql`
    UPDATE components
    SET length_mm = CASE WHEN length_mm IN (240, 310, 150) THEN NULL ELSE length_mm END,
        tdp = CASE WHEN tdp IN (120, 300, 30) THEN NULL ELSE tdp END,
        vram_gb = CASE WHEN vram_gb IN (8, 20, 2) THEN NULL ELSE vram_gb END,
        chipset = CASE WHEN chipset = 'GeForce GT 730' THEN NULL ELSE chipset END,
        updated_at = NOW()
    WHERE category = 'gpu' AND is_active = true
      AND (
        length_mm IN (240, 310, 150)
        OR tdp IN (120, 300, 30)
        OR vram_gb IN (8, 20, 2)
        OR chipset = 'GeForce GT 730'
      )
  `;
  console.log(`✅ GPU reset complete: ${gpuReset.count ?? 0} rows reset to NULL.`);

  // 6. PSUs
  console.log('🔄 Clearing PSU defaults...');
  const psuReset = await sql`
    UPDATE components
    SET wattage = CASE WHEN wattage = 650 THEN NULL ELSE wattage END,
        efficiency_rating = CASE WHEN efficiency_rating = 'Gold' THEN NULL ELSE efficiency_rating END,
        modular = CASE WHEN modular = 'Non' THEN NULL ELSE modular END,
        updated_at = NOW()
    WHERE category = 'psu' AND is_active = true
      AND (
        wattage = 650
        OR efficiency_rating = 'Gold'
        OR modular = 'Non'
      )
  `;
  console.log(`✅ PSU reset complete: ${psuReset.count ?? 0} rows reset to NULL.`);

  // 7. Thermal Paste
  console.log('🔄 Clearing Thermal Paste defaults...');
  const pasteReset = await sql`
    UPDATE components
    SET weight_grams = NULL,
        paste_type = NULL,
        thermal_conductivity = NULL,
        updated_at = NOW()
    WHERE category = 'thermal_paste' AND is_active = true
      AND weight_grams = 4 AND paste_type = 'paste' AND thermal_conductivity = 8
  `;
  console.log(`✅ Thermal Paste reset complete: ${pasteReset.count ?? 0} rows reset to NULL.`);

  // 8. Specific minor fixes
  console.log('🔄 Clearing minor specific defaults...');
  await sql`UPDATE components SET max_ram_frequency = NULL WHERE category = 'motherboard' AND max_ram_frequency = 3200`;

  console.log('\n✨ Database specification purge complete! All artificial default specs cleared.');
}

run()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Error during purge:', err);
    process.exit(1);
  });
