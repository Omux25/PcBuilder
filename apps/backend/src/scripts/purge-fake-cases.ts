/**
 * purge-fake-cases.ts — The Great Purge
 *
 * Identifies components sitting in the `case` category whose names betray
 * them as cooling accessories (fans, coolers, AIOs, hubs, thermal paste).
 *
 * For each pollutant:
 *   1. Strip the fake case specs  (max_gpu_length_mm, max_cpu_cooler_height_mm,
 *      form_factors inside the specs JSON column).
 *   2. Re-route to the correct category:
 *        - CPU coolers / AIO / watercooling → `cooling`
 *        - Case fans / ARGB / PWM / hub     → `fan`
 *        - Thermal paste                    → `thermal_paste`
 *      Items that can't be unambiguously re-routed stay inactivated so they
 *      don't pollute the case catalog without a home.
 *
 * Run with:
 *   bun apps/backend/src/scripts/purge-fake-cases.ts
 */

import { getSql } from '../core/db/index.js';

// ── Keyword → target-category map ────────────────────────────────────────────
// Evaluated in order; first match wins.
const COOLING_ROUTING_RULES: Array<{
  keywords: string[];
  targetCategory: string;
  label: string;
}> = [
  {
    keywords: ['aio', 'watercooling', 'watercooler', 'water cooler', 'liquid freezer', 'liquid cooling', 'refroidissement liquide'],
    targetCategory: 'cooling',
    label: 'AIO / Liquid Cooler',
  },
  {
    keywords: ['cooler', 'refroidisseur', 'ventirad', 'cpu cooler', 'air cooler'],
    targetCategory: 'cooling',
    label: 'CPU Cooler',
  },
  {
    keywords: ['pate thermique', 'pâte thermique', 'thermal paste', 'thermal compound', 'thermal grease', 'glacier'],
    targetCategory: 'thermal_paste',
    label: 'Thermal Paste',
  },
  {
    keywords: ['hub', 'fan hub', 'rgb hub', 'argb hub'],
    targetCategory: 'fan',
    label: 'Fan Hub',
  },
  {
    keywords: ['fan', 'ventilateur', 'argb', 'pwm'],
    targetCategory: 'fan',
    label: 'Case Fan / ARGB Fan',
  },
];

/** Derives the correct target category from a product name. */
function resolveTargetCategory(name: string): string | null {
  const lower = name.toLowerCase();
  for (const rule of COOLING_ROUTING_RULES) {
    if (rule.keywords.some(kw => lower.includes(kw))) {
      return rule.targetCategory;
    }
  }
  return null;
}

/** Returns the human-readable rule label for logging. */
function resolveRuleLabel(name: string): string {
  const lower = name.toLowerCase();
  for (const rule of COOLING_ROUTING_RULES) {
    if (rule.keywords.some(kw => lower.includes(kw))) {
      return rule.label;
    }
  }
  return 'Unknown';
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function purgeFakeCases() {
  const sql = getSql();

  console.log('🔍 Step 1 — Scanning case catalog for pollution...\n');

  // All negative keywords merged into a single SQL regex for identification.
  // The ORDER matters only for logging; routing uses the JS rules above.
  const polluted = (await sql`
    SELECT id, name, brand, category, max_gpu_length_mm, max_cooler_height_mm, supported_motherboards, specs
    FROM components
    WHERE category = 'case'
      AND is_active = true
      AND name ~* '(\\mfan\\M|ventilateur|\\mcooler\\M|refroidisseur|\\baio\\b|watercooling|watercooler|\\bhub\\b|argb|\\bpwm\\b|pate thermique|pâte thermique|thermal paste|glacier)'
    ORDER BY name
  `) as {
    id: number;
    name: string;
    brand: string | null;
    category: string;
    max_gpu_length_mm: number | null;
    max_cooler_height_mm: number | null;
    supported_motherboards: string[] | null;
    specs: Record<string, unknown> | null;
  }[];

  if (polluted.length === 0) {
    console.log('✅ Case catalog is clean — no cooling pollutants found.');
    return;
  }

  console.log(`Found ${polluted.length} polluted record(s):\n`);

  // Group by target category for a clean summary log
  const byTarget = new Map<string, typeof polluted>();
  for (const item of polluted) {
    const target = resolveTargetCategory(item.name) ?? 'fan'; // safe fallback
    const list = byTarget.get(target) ?? [];
    list.push(item);
    byTarget.set(target, list);
  }

  for (const [target, items] of byTarget.entries()) {
    console.log(`  → ${target.toUpperCase()} (${items.length}):`);
    items.forEach(i => console.log(`      [${i.id}] ${i.brand ?? ''} ${i.name}`));
  }

  console.log('\n🧹 Step 2 — Purging fake case specs and re-routing...\n');

  let rerouted = 0;
  let specsCleaned = 0;

  for (const item of polluted) {
    const targetCategory = resolveTargetCategory(item.name) ?? 'fan';
    const label = resolveRuleLabel(item.name);

    // Strip fake case dimensions from the specs JSON blob
    let cleanedSpecs: Record<string, unknown> = {};
    if (item.specs && typeof item.specs === 'object') {
      cleanedSpecs = { ...item.specs as Record<string, unknown> };
      delete cleanedSpecs['max_gpu_length_mm'];
      delete cleanedSpecs['max_cpu_cooler_height_mm'];
      delete cleanedSpecs['form_factors'];
    }

    try {
      await sql`
        UPDATE components
        SET
          category              = ${targetCategory},
          max_gpu_length_mm     = NULL,
          max_cooler_height_mm  = NULL,
          supported_motherboards = NULL,
          specs                 = ${Object.keys(cleanedSpecs).length > 0 ? JSON.stringify(cleanedSpecs) : null},
          updated_at            = NOW()
        WHERE id = ${item.id}
      `;

      console.log(
        `  [${item.id}] ✅ "${item.brand ?? ''} ${item.name}"\n` +
        `       case → ${targetCategory}   (${label})\n` +
        `       Stripped: max_gpu_length_mm=${item.max_gpu_length_mm ?? 'NULL'}, ` +
        `max_cooler_height_mm=${item.max_cooler_height_mm ?? 'NULL'}, supported_motherboards\n`
      );

      rerouted++;
      if (item.max_gpu_length_mm !== null || item.max_cooler_height_mm !== null) {
        specsCleaned++;
      }
    } catch (err) {
      console.error(`  [${item.id}] ❌ Failed to update "${item.name}":`, err);
    }
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════════');
  console.log(`✨ Purge complete.`);
  console.log(`   Records re-routed out of case catalog : ${rerouted}`);
  console.log(`   Records with fake specs stripped       : ${specsCleaned}`);
  console.log('══════════════════════════════════════════════════════════\n');

  // ── Verification ─────────────────────────────────────────────────────────
  console.log('🔎 Post-purge verification — remaining cases (should be 0 pollutants):\n');
  const remaining = (await sql`
    SELECT id, name, brand
    FROM components
    WHERE category = 'case'
      AND is_active = true
      AND name ~* '(\\mfan\\M|ventilateur|\\mcooler\\M|refroidisseur|\\baio\\b|watercooling|watercooler|\\bhub\\b|argb|\\bpwm\\b|pate thermique|p\u00e2te thermique|thermal paste|glacier)'
  `) as { id: number; name: string; brand: string | null }[];

  if (remaining.length === 0) {
    console.log('  ✅ Zero pollutants remain in the case catalog.\n');
  } else {
    console.log(`  ⚠️  ${remaining.length} potential pollutants still detected (may need manual review):`);
    remaining.forEach(r => console.log(`    [${r.id}] ${r.brand ?? ''} ${r.name}`));
  }

  // ── Final case catalog health check ───────────────────────────────────────
  const [caseCount] = (await sql`
    SELECT COUNT(*) AS total FROM components WHERE category = 'case' AND is_active = true
  `) as { total: string }[];
  const [fanCount] = (await sql`
    SELECT COUNT(*) AS total FROM components WHERE category = 'fan' AND is_active = true
  `) as { total: string }[];
  const [coolingCount] = (await sql`
    SELECT COUNT(*) AS total FROM components WHERE category = 'cooling' AND is_active = true
  `) as { total: string }[];

  console.log('\n📊 Post-purge catalog counts:');
  console.log(`   case     : ${caseCount.total}`);
  console.log(`   fan      : ${fanCount.total}`);
  console.log(`   cooling  : ${coolingCount.total}\n`);
}

purgeFakeCases().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
