/**
 * Runs price scrapes for all active retailers and populates the prices table.
 *
 * Usage: bun scripts/tools/run_all_scrapes.ts
 */
import { runScrapingSession } from '../../src/modules/scraping/engine/session.js';
import { getSql } from '../../src/core/db/index.js';

console.log('🚀 Starting full price scrape for all retailers...\n');

const startTime = Date.now();

try {
  await runScrapingSession();

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n⏱️  Total time: ${elapsed}s\n`);

  const sql = getSql();
  const summary = await sql`
    SELECT r.name, COUNT(p.id) AS price_count
    FROM retailers r
    LEFT JOIN prices p ON p.retailer_id = r.id
    WHERE r.is_active = true
    GROUP BY r.id, r.name
    ORDER BY r.name
  ` as { name: string; price_count: string }[];

  console.log('📊 Final Price Counts:');
  for (const row of summary) {
    console.log(`   ${row.name.padEnd(20)} ${row.price_count.padStart(6)} prices`);
  }

  // Check image stats
  const imageStats = await sql`
    SELECT
      COUNT(*) as total,
      COUNT(image_url) as with_images
    FROM components
  ` as { total: string; with_images: string }[];

  const total = parseInt(imageStats[0].total);
  const withImages = parseInt(imageStats[0].with_images);
  const percentage = Math.round((withImages / total) * 100);

  console.log(`\n🖼️  Image Coverage: ${withImages}/${total} components (${percentage}%)`);
  console.log('\n✅ Scrape complete!\n');

  console.log('🔄 Automatically running the 100% specification enrichment pipeline...');
  const { $ } = await import('bun');
  await $`bun scripts/enrich_database.ts`;
} catch (err) {
  console.error('\n💥 Full scrape failed:');
  console.error(err);
  process.exit(1);
}
