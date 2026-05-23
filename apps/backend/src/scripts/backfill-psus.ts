import { getSql } from '../core/db/index.js';
import { runDeepRetailerBackfill } from '../modules/scraping/services/enrichmentService.js';

async function main() {
  const sql = getSql();
  
  // 1. Audit before
  const before = await sql`
    SELECT count(*)::int FROM components 
    WHERE category = 'psu' 
      AND (wattage IS NULL OR efficiency_rating IS NULL OR modular IS NULL)
  ` as { count: number }[];
  console.log(`[AUDIT] PSU components lacking specs before enrichment: ${before[0].count}`);

  console.log('\n--- RUNNING DEEP RETAILER ENRICHMENT BACKFILL ---');
  await runDeepRetailerBackfill();

  // 2. Audit after
  const after = await sql`
    SELECT count(*)::int FROM components 
    WHERE category = 'psu' 
      AND (wattage IS NULL OR efficiency_rating IS NULL OR modular IS NULL)
  ` as { count: number }[];
  console.log(`[AUDIT] PSU components lacking specs after enrichment: ${after[0].count}`);

  process.exit(0);
}

main().catch(err => {
  console.error('Backfill script failed:', err);
  process.exit(1);
});
