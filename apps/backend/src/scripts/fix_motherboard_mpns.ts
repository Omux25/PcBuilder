import { getSql } from '../core/db/index.js';

const sql = getSql();

async function run() {
  console.log('🚀 Starting Motherboard MPN Cleanup...');

  const FORBIDDEN_MPNS = [
    'BIOSTAR', 'ASROCK', 'TORPEDO', 'TOMAHAWK', 'STRIX', 'GIGABYTE', 'PRIME', 'AORUS', 'GAMING', 'CARTE', 'SOCKET', 'MAXIMUS',
    'B550M', 'B660M', 'Z690M', 'B560M', 'B650M', 'H510M-A'
  ];

  // 1. Invalidate generic motherboard MPNs
  const result = await sql`
    UPDATE components
    SET mpn = NULL, updated_at = NOW()
    WHERE category = 'motherboard'
      AND UPPER(TRIM(mpn)) IN ${sql(FORBIDDEN_MPNS)}
    RETURNING id, name, brand, mpn
  ` as any[];

  console.log(`🧹 Cleaned ${result.length} motherboard entries with generic MPNs.`);
  if (result.length > 0) {
    console.log(JSON.stringify(result, null, 2));
  }

  // 2. Invalidate duplicate barcode 4711377180955 from Gigabyte B650M Gaming Plus WiFi (keep it on MSI B650M Gaming Plus WiFi)
  const resultDupe = await sql`
    UPDATE components
    SET mpn = NULL, updated_at = NOW()
    WHERE id = 1060
    RETURNING id, name, brand, mpn
  ` as any[];

  console.log(`🧹 Cleaned barcode collision from Gigabyte B650M Gaming Plus WiFi:`, resultDupe);

  console.log('✨ Motherboard MPN Cleanup Completed Successfully!');
  process.exit(0);
}

run().catch(console.error);
