/**
 * Run the catalog builder against all pending unmatched listings.
 * Shows real-time progress so you're not waiting blindly.
 */
import { sql } from 'bun';
import { buildFromUnmatched } from '../scraper/catalogBuilder.js';
import { autoMap } from '../scraper/autoMapper.js';

// ── Progress bar helper ───────────────────────────────────────────────────────

function progressBar(done: number, total: number, width = 30): string {
  const pct = total === 0 ? 1 : done / total;
  const filled = Math.round(pct * width);
  const bar = '█'.repeat(filled) + '░'.repeat(width - filled);
  const percent = Math.round(pct * 100).toString().padStart(3);
  return `[${bar}] ${percent}% (${done}/${total})`;
}

function printProgress(label: string, done: number, total: number) {
  process.stdout.write(`\r  ${label}: ${progressBar(done, total)}`);
}

// ── Step 1: autoMap ───────────────────────────────────────────────────────────

const pending1 = await sql`
  SELECT COUNT(*)::int AS cnt FROM unmatched_listings
  WHERE status = 'pending' AND scraped_name IS NOT NULL AND scraped_name != ''
` as { cnt: number }[];
const total1 = pending1[0].cnt;

console.log(`\nStep 1/3 — autoMap: matching ${total1} pending listings against catalog...`);
printProgress('Matching', 0, total1);

const { mapped, skipped: s1 } = await autoMap((done, total) => printProgress('Matching', done, total));
process.stdout.write('\n');
console.log(`  Done: ${mapped} mapped, ${s1} skipped`);

// ── Step 2: catalogBuilder ────────────────────────────────────────────────────

const pending2 = await sql`
  SELECT COUNT(*)::int AS cnt FROM unmatched_listings
  WHERE status = 'pending' AND scraped_name IS NOT NULL AND scraped_name != ''
` as { cnt: number }[];
const total2 = pending2[0].cnt;

console.log(`\nStep 2/3 — catalogBuilder: creating entries for ${total2} remaining listings...`);
printProgress('Building', 0, total2);

const { created, skipped } = await buildFromUnmatched((done, total) => printProgress('Building', done, total));
process.stdout.write('\n');
console.log(`  Done: ${created} created, ${skipped} skipped`);

// ── Step 3: autoMap pass 2 ────────────────────────────────────────────────────

if (created > 0) {
  const pending3 = await sql`
    SELECT COUNT(*)::int AS cnt FROM unmatched_listings
    WHERE status = 'pending' AND scraped_name IS NOT NULL AND scraped_name != ''
  ` as { cnt: number }[];
  const total3 = pending3[0].cnt;

  console.log(`\nStep 3/3 — autoMap pass 2: linking ${total3} listings to new entries...`);
  printProgress('Linking', 0, total3);

  const { mapped: mapped2, skipped: s2 } = await autoMap((done, total) => printProgress('Linking', done, total));
  process.stdout.write('\n');
  console.log(`  Done: ${mapped2} mapped, ${s2} skipped`);
} else {
  console.log('\nStep 3/3 — skipped (no new entries created)');
}

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
