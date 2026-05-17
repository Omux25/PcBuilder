/**
 * Run the catalog builder against all pending unmatched listings.
 * Shows real-time progress so you're not waiting blindly.
 */
import { sql } from 'bun';
import { reprocessUnmatched } from '../../src/modules/scraping/engine/aggregator.js';

// ── Progress bar helper ───────────────────────────────────────────────────────

function progressBar(done: number, total: number, width = 30): string {
  const pct = total === 0 ? 1 : done / total;
  const filled = Math.round(pct * width);
  const bar = '█'.repeat(filled) + '░'.repeat(width - filled);
  const percent = Math.round(pct * 100).toString().padStart(3);
  return `[${bar}] ${percent}% (${done}/${total})`;
}

// ── Unified Pipeline ─────────────────────────────────────────────────────────

const pendingCount = await sql`
  SELECT COUNT(*)::int AS cnt FROM unmatched_listings
  WHERE status = 'pending' AND scraped_name IS NOT NULL AND scraped_name != ''
` as { cnt: number }[];
const total = pendingCount[0].cnt;

console.log(`\nUnified Pipeline: processing ${total} pending listings...`);

const { updated, unmatched, errors } = await reprocessUnmatched();

console.log(`\nDone: ${updated} processed (linked/created), ${unmatched} still unmatched, ${errors} errors`);

// ── Final stats ───────────────────────────────────────────────────────────────

const stats = await sql`
  SELECT
    (SELECT COUNT(*)::int FROM components WHERE is_active = true)  AS active_components,
    (SELECT COUNT(*)::int FROM scraper_mappings)                   AS mappings,
    (SELECT COUNT(*)::int FROM prices)                             AS prices,
    (SELECT COUNT(DISTINCT component_id)::int FROM prices)         AS components_with_prices,
    (SELECT COUNT(*)::int FROM unmatched_listings WHERE status = 'pending') AS still_pending
` as Record<string, number>[];

const s = stats[0];
const pct = Math.round(s.components_with_prices / s.active_components * 100);

console.log('\n' + '─'.repeat(50));
console.log('Final stats');
console.log('─'.repeat(50));
console.log(`  Active components:      ${s.active_components}`);
console.log(`  Scraper mappings:       ${s.mappings}`);
console.log(`  Components with prices: ${s.components_with_prices} / ${s.active_components} (${pct}%)`);
console.log(`  Coverage bar:           ${progressBar(s.components_with_prices, s.active_components)}`);
console.log(`  Still pending:          ${s.still_pending}`);
console.log('─'.repeat(50));

process.exit(0);
