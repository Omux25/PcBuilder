/**
 * Runs price scrapes for all active retailers and populates the prices table.
 * 
 * Usage: bun scripts/tools/run_all_scrapes.ts
 */
import { runScrapingSession } from '../../scraper/session.js';
import { getSql } from '../../src/db/index.js';

console.log('Starting full price scrape for all retailers...');

try {
  await runScrapingSession();

  const sql = getSql();
  const summary = await sql`
    SELECT r.name, COUNT(p.id) AS price_count
    FROM retailers r
    LEFT JOIN prices p ON p.retailer_id = r.id
    WHERE r.is_active = true
    GROUP BY r.id, r.name
    ORDER BY r.name
  ` as { name: string; price_count: string }[];

  console.log('\n=== Final Price Counts ===');
  for (const row of summary) {
    console.log(`  ${row.name}: ${row.price_count} prices`);
  }
} catch (err) {
  console.error('\n💥 Full scrape failed:');
  console.error(err);
  process.exit(1);
}
