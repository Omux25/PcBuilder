/**
 * Run the catalog builder against all pending unmatched listings.
 */
import { buildFromUnmatched } from '../scraper/catalogBuilder.js';
import { autoMap } from '../scraper/autoMapper.js';

console.log('Running autoMap first (match existing catalog)...');
const { mapped, skipped: s1 } = await autoMap();
console.log(`  autoMap: ${mapped} mapped, ${s1} skipped`);

console.log('\nRunning catalogBuilder (create new entries)...');
const { created, skipped } = await buildFromUnmatched();
console.log(`  catalogBuilder: ${created} created, ${skipped} skipped`);

if (created > 0) {
  console.log('\nRunning autoMap again (link to newly created entries)...');
  const { mapped: mapped2, skipped: s2 } = await autoMap();
  console.log(`  autoMap pass 2: ${mapped2} mapped, ${s2} skipped`);
}

// Final stats
const { sql } = await import('bun');
const stats = await sql`
  SELECT
    (SELECT COUNT(*) FROM components WHERE is_active = true)::int AS active_components,
    (SELECT COUNT(*) FROM scraper_mappings)::int AS mappings,
    (SELECT COUNT(*) FROM prices)::int AS prices,
    (SELECT COUNT(DISTINCT component_id) FROM prices)::int AS components_with_prices,
    (SELECT COUNT(*) FROM unmatched_listings WHERE status = 'pending')::int AS still_pending
` as Record<string, number>[];

const s = stats[0];
console.log('\n=== Final stats ===');
console.log(`Active components:      ${s.active_components}`);
console.log(`Scraper mappings:       ${s.mappings}`);
console.log(`Components with prices: ${s.components_with_prices} / ${s.active_components} (${Math.round(s.components_with_prices / s.active_components * 100)}%)`);
console.log(`Still pending:          ${s.still_pending}`);

process.exit(0);
