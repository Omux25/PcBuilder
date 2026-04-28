import { sql } from 'bun';

const stats = await sql`
  SELECT
    (SELECT COUNT(*) FROM components WHERE is_active = true)::int AS active_components,
    (SELECT COUNT(*) FROM components WHERE is_active = false)::int AS inactive_components,
    (SELECT COUNT(*) FROM scraper_mappings)::int AS mappings,
    (SELECT COUNT(*) FROM prices)::int AS prices,
    (SELECT COUNT(DISTINCT component_id) FROM prices)::int AS components_with_prices,
    (SELECT COUNT(*) FROM unmatched_listings WHERE status = 'pending')::int AS unmatched_pending,
    (SELECT COUNT(*) FROM retailers WHERE is_active = true)::int AS active_retailers
` as Record<string, number>[];

const s = stats[0];
console.log('\n=== Database Stats ===');
console.log(`Active components:       ${s.active_components}`);
console.log(`Inactive (generics etc): ${s.inactive_components}`);
console.log(`Scraper mappings:        ${s.mappings}`);
console.log(`Price rows:              ${s.prices}`);
console.log(`Components with prices:  ${s.components_with_prices} / ${s.active_components} (${Math.round(s.components_with_prices / s.active_components * 100)}%)`);
console.log(`Unmatched (pending):     ${s.unmatched_pending}`);
console.log(`Active retailers:        ${s.active_retailers}`);

// Coverage per category
const coverage = await sql`
  SELECT
    c.category,
    COUNT(DISTINCT c.id)::int AS total,
    COUNT(DISTINCT p.component_id)::int AS with_prices
  FROM components c
  LEFT JOIN prices p ON p.component_id = c.id
  WHERE c.is_active = true
  GROUP BY c.category ORDER BY c.category
` as { category: string; total: number; with_prices: number }[];

console.log('\n=== Coverage by category ===');
for (const row of coverage) {
  const pct = row.total > 0 ? Math.round(row.with_prices / row.total * 100) : 0;
  const bar = '█'.repeat(Math.round(pct / 5)) + '░'.repeat(20 - Math.round(pct / 5));
  console.log(`  ${row.category.padEnd(12)} ${bar} ${row.with_prices}/${row.total} (${pct}%)`);
}

process.exit(0);
