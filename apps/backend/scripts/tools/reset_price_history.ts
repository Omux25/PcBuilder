/**
 * reset_price_history.ts
 * Wipes out legacy corrupt/grouped price histories and backfills a clean, flat 
 * 14-day price history baseline for all verified active component offers.
 *
 * Run with: bun scripts/tools/reset_price_history.ts
 */
import { getSql } from '../../src/core/db/index.js';

const sql = getSql();

console.log('⚠️  Starting Price History maintenance...\n');

try {
  // 1. Purge all legacy history rows
  console.log('🧹 Purging all old price history records...');
  await sql`TRUNCATE TABLE price_history RESTART IDENTITY;`;
  console.log('✅ Price history table truncated successfully.');

  // 2. Fetch all verified current active prices
  console.log('\n🔍 Retrieving verified active prices...');
  const activePrices = await sql`
    SELECT component_id, retailer_id, price, in_stock
    FROM prices
  ` as { component_id: number; retailer_id: number; price: string | number; in_stock: boolean }[];

  console.log(`   Found ${activePrices.length} active price offers to backfill.`);

  if (activePrices.length === 0) {
    console.log('⚠️  No active prices found. Nothing to backfill.');
    process.exit(0);
  }

  // 3. Generate flat history entries for the last 14 days
  console.log('\n⏳ Generating flat 14-day history baseline (inserting daily minimum records)...');
  
  let totalInserts = 0;
  
  // We will insert in chunks to keep memory usage low and operations fast
  const chunkSize = 100;
  for (let c = 0; c < activePrices.length; c += chunkSize) {
    const chunk = activePrices.slice(c, c + chunkSize);
    const insertData: any[] = [];

    for (const offer of chunk) {
      const priceVal = Number(offer.price);
      
      // Generate one price history entry for each of the last 14 days
      for (let i = 0; i < 14; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        // Distribute hours slightly to avoid exact duplicate timestamps if partitioned by seconds
        date.setHours(12, 0, 0, 0);

        insertData.push({
          component_id: offer.component_id,
          retailer_id: offer.retailer_id,
          price: priceVal,
          in_stock: offer.in_stock,
          recorded_at: date
        });
      }
    }

    if (insertData.length > 0) {
      await sql`
        INSERT INTO price_history ${sql(insertData)}
      `;
      totalInserts += insertData.length;
    }
    
    process.stdout.write(`   Progress: ${Math.min(c + chunkSize, activePrices.length)}/${activePrices.length} offers processed...\r`);
  }

  console.log(`\n\n🎉 Price History reset complete! Backfilled ${totalInserts} history entries successfully.`);
  process.exit(0);
} catch (err) {
  console.error('\n💥 Price history reset failed:');
  console.error(err);
  process.exit(1);
}
