/**
 * evaluate_matcher.ts — Precision/Recall evaluation of the DNA matcher.
 *
 * Runs findBestMatch against the golden dataset and reports:
 *   - Precision: when we match, are we correct? (must be 1.0)
 *   - Recall:    how many matchable items did we catch? (target 85%+)
 *   - False Positives: the ultimate sin — wrong match (must be 0)
 *
 * Exits with code 1 if any false positive is found (CI-safe).
 *
 * Run with:
 *   bun run scripts/evaluate_matcher.ts
 *
 * Based on Gemini's ML-style evaluation framework recommendation.
 */

import { sql } from 'bun';
import { findBestMatch, type CatalogComponent } from '../src/utils/componentMatcher.js';
import goldenData from '../tests/fixtures/golden_dataset.json';

// ── Load catalog from DB ──────────────────────────────────────────────────────

const components = await sql`
  SELECT id, name, brand, category, slug FROM components WHERE is_active = true
` as (CatalogComponent & { slug: string })[];

if (components.length === 0) {
  console.error('No components found in DB. Run seed scripts first.');
  process.exit(1);
}

// Build slug → id map for golden dataset lookup
const slugToId = new Map(components.map((c) => [c.slug, c.id]));

// ── Evaluate ──────────────────────────────────────────────────────────────────

let truePositives  = 0;
let falsePositives = 0; // wrong match — the ultimate sin
let falseNegatives = 0; // missed a match we should have caught
let trueNegatives  = 0; // correctly rejected garbage

const falsePositiveLog: string[] = [];
const falseNegativeLog: string[] = [];

for (const item of goldenData) {
  const result = findBestMatch(item.scraped_title, components);
  const matchedId = result?.componentId ?? null;

  if (item.expected_action === 'match') {
    const expectedId = item.catalog_slug ? (slugToId.get(item.catalog_slug) ?? null) : null;

    if (expectedId === null) {
      console.warn(`[SKIP] Slug not found in DB: ${item.catalog_slug} — "${item.scraped_title}"`);
      continue;
    }

    if (matchedId === expectedId) {
      truePositives++;
    } else if (matchedId === null) {
      falseNegatives++;
      falseNegativeLog.push(`  [MISS] Expected slug=${item.catalog_slug} (id=${expectedId}) but got nothing\n         Title: "${item.scraped_title}"\n         Reason: ${item.reason}`);
    } else {
      falsePositives++;
      const matchedSlug = components.find((c) => c.id === matchedId)?.slug ?? '?';
      falsePositiveLog.push(`  [FATAL] Mapped to ${matchedSlug} (id=${matchedId}) instead of ${item.catalog_slug} (id=${expectedId})\n          Title: "${item.scraped_title}"\n          Reason: ${item.reason}`);
    }

  } else if (item.expected_action === 'ignore') {
    if (matchedId === null) {
      trueNegatives++;
    } else {
      falsePositives++;
      const matchedSlug = components.find((c) => c.id === matchedId)?.slug ?? '?';
      falsePositiveLog.push(`  [FATAL] Matched garbage to ${matchedSlug} (id=${matchedId})\n          Title: "${item.scraped_title}"\n          Reason: ${item.reason}`);
    }
  }
}

// ── Report ────────────────────────────────────────────────────────────────────

const total = truePositives + falsePositives + falseNegatives + trueNegatives;
const precision = truePositives / (truePositives + falsePositives || 1);
const recall    = truePositives / (truePositives + falseNegatives || 1);
const f1        = precision + recall > 0 ? 2 * (precision * recall) / (precision + recall) : 0;

console.log('\n╔══════════════════════════════════════════════════╗');
console.log('║         MATCHER EVALUATION REPORT               ║');
console.log('╚══════════════════════════════════════════════════╝');
console.log(`\nDataset: ${total} items (${goldenData.filter((i) => i.expected_action === 'match').length} match, ${goldenData.filter((i) => i.expected_action === 'ignore').length} ignore)`);
console.log(`Catalog: ${components.length} components\n`);

console.log('── Results ──────────────────────────────────────────');
console.log(`  True Positives  (correct match):   ${truePositives}`);
console.log(`  True Negatives  (correct reject):  ${trueNegatives}`);
console.log(`  False Negatives (missed match):    ${falseNegatives}`);
console.log(`  False Positives (WRONG match):     ${falsePositives}`);

console.log('\n── Metrics ──────────────────────────────────────────');
console.log(`  Precision (must be 1.000): ${precision.toFixed(4)}  ${precision === 1.0 ? '✓' : '✗ FAIL'}`);
console.log(`  Recall    (target ≥ 0.85): ${recall.toFixed(4)}  ${recall >= 0.85 ? '✓' : recall >= 0.70 ? '⚠ below target' : '✗ low'}`);
console.log(`  F1 Score:                  ${f1.toFixed(4)}`);

if (falseNegativeLog.length > 0) {
  console.log('\n── Missed Matches (False Negatives) ─────────────────');
  for (const msg of falseNegativeLog) console.log(msg);
}

if (falsePositiveLog.length > 0) {
  console.log('\n── WRONG MATCHES (False Positives) ──────────────────');
  for (const msg of falsePositiveLog) console.log(msg);
}

console.log('\n─────────────────────────────────────────────────────');

if (falsePositives > 0) {
  console.error(`\n✗ EVALUATION FAILED — ${falsePositives} false positive(s) detected.`);
  console.error('  False positives corrupt pricing data. Fix the matcher before deploying.\n');
  process.exit(1);
} else {
  console.log(`\n✓ Precision is perfect (0 false positives).`);
  if (recall < 0.85) {
    console.log(`⚠ Recall is ${(recall * 100).toFixed(1)}% — below 85% target. Consider expanding the catalog or improving DNA extractors.`);
  } else {
    console.log(`✓ Recall is ${(recall * 100).toFixed(1)}% — meets target.`);
  }
  console.log('');
}
