/**
 * shadow_run_matcher.ts — Dry-run the DNA matcher against unmatched_listings.
 *
 * Reads all unmatched_listings from the DB, runs findBestMatch on each title,
 * and outputs a CSV file for manual review — WITHOUT touching scraper_mappings.
 *
 * Review the CSV before running remap_all.ts. Your eyes will catch anomalies
 * (like a CPU cooler matching a case fan) faster than any script.
 *
 * Output: backend/scripts/shadow_run_output.csv
 *
 * Run with:
 *   bun run scripts/shadow_run_matcher.ts
 *
 * Based on Gemini's "Shadow Run" recommendation.
 */

import { sql } from 'bun';
import { writeFile } from 'fs/promises';
import { findBestMatch, type CatalogComponent } from '../src/utils/componentMatcher.js';

// ── Load data ─────────────────────────────────────────────────────────────────

console.log('Loading catalog components...');
const components = await sql`
  SELECT id, name, brand, category, slug FROM components WHERE is_active = true
` as (CatalogComponent & { slug: string })[];
console.log(`  ${components.length} components loaded.`);

console.log('Loading unmatched listings...');
const unmatched = await sql`
  SELECT ul.id, ul.retailer_id, ul.scraped_name, ul.scraped_price, ul.product_url,
         r.name AS retailer_name
  FROM unmatched_listings ul
  JOIN retailers r ON r.id = ul.retailer_id
  WHERE ul.status = 'pending'
  ORDER BY ul.retailer_id, ul.scraped_name
` as {
  id: number;
  retailer_id: number;
  scraped_name: string;
  scraped_price: number;
  product_url: string;
  retailer_name: string;
}[];
console.log(`  ${unmatched.length} unmatched listings found.\n`);

if (unmatched.length === 0) {
  console.log('No pending unmatched listings. Nothing to do.');
  process.exit(0);
}

// ── Run matcher ───────────────────────────────────────────────────────────────

interface ShadowResult {
  unmatched_id: number;
  retailer: string;
  scraped_name: string;
  scraped_price: number;
  product_url: string;
  matched_slug: string;
  matched_name: string;
  matched_category: string;
  score: string;
  action: string;
}

const results: ShadowResult[] = [];
let wouldMatch = 0;
let wouldIgnore = 0;

for (const item of unmatched) {
  const match = findBestMatch(item.scraped_name, components, 1.0);

  // Also try partial match for case/cooling
  const PARTIAL_CATS = new Set(['case', 'cooling']);
  let finalMatch = match;
  if (!finalMatch) {
    const partial = findBestMatch(item.scraped_name, components, 0.8);
    if (partial) {
      const cat = components.find((c) => c.id === partial.componentId)?.category ?? '';
      if (PARTIAL_CATS.has(cat)) finalMatch = partial;
    }
  }

  if (finalMatch) {
    const comp = components.find((c) => c.id === finalMatch!.componentId)!;
    results.push({
      unmatched_id: item.id,
      retailer: item.retailer_name,
      scraped_name: item.scraped_name,
      scraped_price: item.scraped_price,
      product_url: item.product_url,
      matched_slug: comp.slug,
      matched_name: `${comp.brand ?? ''} ${comp.name}`.trim(),
      matched_category: comp.category,
      score: (finalMatch.score * 100).toFixed(0) + '%',
      action: 'WOULD MAP',
    });
    wouldMatch++;
  } else {
    results.push({
      unmatched_id: item.id,
      retailer: item.retailer_name,
      scraped_name: item.scraped_name,
      scraped_price: item.scraped_price,
      product_url: item.product_url,
      matched_slug: '',
      matched_name: '',
      matched_category: '',
      score: '0%',
      action: 'WOULD IGNORE',
    });
    wouldIgnore++;
  }
}

// ── Write CSV ─────────────────────────────────────────────────────────────────

const csvHeader = 'action,score,retailer,scraped_name,scraped_price,matched_name,matched_slug,matched_category,product_url';
const csvRows = results.map((r) => [
  r.action,
  r.score,
  r.retailer,
  `"${r.scraped_name.replace(/"/g, '""')}"`,
  r.scraped_price,
  `"${r.matched_name.replace(/"/g, '""')}"`,
  r.matched_slug,
  r.matched_category,
  r.product_url,
].join(','));

const csv = [csvHeader, ...csvRows].join('\n');
const outputPath = new URL('../scripts/shadow_run_output.csv', import.meta.url).pathname;
await writeFile(outputPath, csv, 'utf-8');

// ── Summary ───────────────────────────────────────────────────────────────────

console.log('═══════════════════════════════════════════════════');
console.log('           SHADOW RUN RESULTS');
console.log('═══════════════════════════════════════════════════');
console.log(`  Total unmatched:  ${unmatched.length}`);
console.log(`  Would map:        ${wouldMatch} (${(wouldMatch / unmatched.length * 100).toFixed(1)}%)`);
console.log(`  Would ignore:     ${wouldIgnore}`);
console.log(`\n  Output: scripts/shadow_run_output.csv`);
console.log('\n  ⚠ Review the CSV manually before running remap_all.ts');
console.log('    Look for: wrong category matches, bundle products,');
console.log('    accessories matched to components, etc.');
console.log('═══════════════════════════════════════════════════\n');
