/**
 * scrape_and_validate.ts — Standalone scrape + data quality check script.
 *
 * Runs UltraPC scraper directly (no HTTP server needed), pipes results through
 * the aggregator, then validates the resulting data quality.
 *
 * Usage:
 *   bun scripts/tools/scrape_and_validate.ts
 *   bun scripts/tools/scrape_and_validate.ts --retailer ultrapc
 *   bun scripts/tools/scrape_and_validate.ts --retailer all
 *
 * Checks performed after scrape:
 *   1. No junk CPU entries (spec text, wrong category)
 *   2. No truncated names (single word, color-only)
 *   3. No all-caps names
 *   4. UltraPC HEDT coverage (Threadripper PRO URLs present)
 *   5. Duplicate component count
 *   6. Unmatched listing count
 */

import { sql } from 'bun';
import { setSql } from '../../src/db/index.js';
import { runScrapingSession } from '../../scraper/session.js';

// ── Config ────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const retailerArg = args.find(a => a.startsWith('--retailer='))?.split('=')[1]
    ?? args[args.indexOf('--retailer') + 1]
    ?? 'ultrapc';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function query<T>(q: string): Promise<T[]> {
    return sql.unsafe(q) as Promise<T[]>;
}

function pass(msg: string) { console.log(`  ✅ ${msg}`); }
function fail(msg: string) { console.log(`  ❌ ${msg}`); }
function warn(msg: string) { console.log(`  ⚠️  ${msg}`); }
function section(msg: string) { console.log(`\n── ${msg} ──`); }

// ── Scrape ────────────────────────────────────────────────────────────────────

async function getRetailerId(name: string): Promise<number | undefined> {
    const rows = await query<{ id: number; name: string }>(
        `SELECT id, name FROM retailers WHERE LOWER(name) LIKE LOWER('%${name}%') AND is_active = true LIMIT 1`
    );
    return rows[0]?.id;
}

async function runScrape(retailer: string): Promise<void> {
    if (retailer === 'all') {
        console.log('\n📡 Running full scrape (all retailers)...');
        await runScrapingSession();
    } else {
        const id = await getRetailerId(retailer);
        if (!id) {
            console.error(`❌ Retailer "${retailer}" not found in DB`);
            process.exit(1);
        }
        console.log(`\n📡 Running targeted scrape for retailer ID ${id} (${retailer})...`);
        await runScrapingSession(id);
    }
}

// ── Validation ────────────────────────────────────────────────────────────────

async function validate(): Promise<{ passed: number; failed: number }> {
    let passed = 0;
    let failed = 0;

    section('Data Quality Checks');

    // 1. Junk CPU entries
    const junkCpus = await query<{ id: number; brand: string; name: string }>(`
    SELECT id, brand, name FROM components
    WHERE category = 'cpu'
      AND (
        name ILIKE '%cœur%'
        OR name ILIKE '%thread%' AND name NOT ILIKE '%threadripper%'
        OR brand ILIKE '%thermal%'
        OR name ILIKE '%grizzly%'
        OR name ILIKE '%direct die%'
        OR name ILIKE '%GHz%'
      )
  `);
    if (junkCpus.length === 0) {
        pass('No junk CPU entries');
        passed++;
    } else {
        fail(`${junkCpus.length} junk CPU entries found:`);
        junkCpus.forEach(c => console.log(`     [${c.id}] ${c.brand} / ${c.name}`));
        failed++;
    }

    // 2. Truncated names (single word, likely color/suffix only)
    const truncated = await query<{ id: number; brand: string; name: string; category: string }>(`
    SELECT id, brand, name, category FROM components
    WHERE name ~ '^[A-Za-z]{2,8}$'
      AND name NOT IN ('AIO', 'ATX', 'ITX', 'DDR4', 'DDR5', 'NAS', 'OEM', 'BOX')
      AND category IN ('cpu','gpu','ram','motherboard','psu','cooling','case','storage','fan','thermal_paste')
    ORDER BY category, name
    LIMIT 20
  `);
    if (truncated.length === 0) {
        pass('No obviously truncated names');
        passed++;
    } else {
        warn(`${truncated.length} possibly truncated names (check manually):`);
        truncated.forEach(c => console.log(`     [${c.id}] ${c.category} / ${c.brand} / ${c.name}`));
    }

    // 3. All-caps names
    const allCaps = await query<{ id: number; brand: string; name: string }>(`
    SELECT id, brand, name FROM components
    WHERE name ~ '^[A-Z0-9 ]{5,}$'
      AND category IN ('cpu','gpu','ram','motherboard','psu','cooling','case','storage')
    LIMIT 10
  `);
    if (allCaps.length === 0) {
        pass('No all-caps component names');
        passed++;
    } else {
        fail(`${allCaps.length} all-caps names found:`);
        allCaps.forEach(c => console.log(`     [${c.id}] ${c.brand} / ${c.name}`));
        failed++;
    }

    // 4. UltraPC HEDT coverage (only if UltraPC was scraped)
    const ultrapcId = await getRetailerId('ultrapc');
    if (ultrapcId) {
        const hedtUrls = await query<{ product_url: string }>(`
      SELECT product_url FROM scraper_mappings
      WHERE retailer_id = ${ultrapcId}
        AND (product_url LIKE '%swrx8%' OR product_url LIKE '%socket-amd-tr4%' OR product_url LIKE '%socket-2066%')
      LIMIT 5
    `);
        if (hedtUrls.length > 0) {
            pass(`UltraPC HEDT coverage: ${hedtUrls.length} HEDT product(s) mapped`);
            passed++;
        } else {
            warn('UltraPC HEDT sub-categories not scraped yet (run full UltraPC scrape)');
        }

        // UltraPC total coverage
        const ultrapcCount = await query<{ cnt: number }>(`
      SELECT COUNT(DISTINCT product_url) as cnt FROM scraper_mappings WHERE retailer_id = ${ultrapcId}
    `);
        console.log(`     UltraPC: ${ultrapcCount[0]?.cnt ?? 0} mapped products`);
    }

    // 5. Duplicates
    const dupes = await query<{ name: string; cnt: number }>(`
    SELECT name, COUNT(*) as cnt
    FROM components
    WHERE is_active = true
    GROUP BY LOWER(TRIM(COALESCE(brand,''))), LOWER(TRIM(name))
    HAVING COUNT(*) > 1
    ORDER BY cnt DESC
    LIMIT 10
  `);
    if (dupes.length === 0) {
        pass('No duplicate components');
        passed++;
    } else {
        fail(`${dupes.length} duplicate component groups:`);
        dupes.forEach(d => console.log(`     ${d.name} (${d.cnt}x)`));
        failed++;
    }

    // 6. Unmatched count
    const unmatched = await query<{ cnt: number }>(`
    SELECT COUNT(*) as cnt FROM unmatched_listings WHERE status = 'pending'
  `);
    const unmatchedCount = Number(unmatched[0]?.cnt ?? 0);
    if (unmatchedCount < 300) {
        pass(`Unmatched listings: ${unmatchedCount} (acceptable)`);
        passed++;
    } else {
        warn(`Unmatched listings: ${unmatchedCount} (high — may need review)`);
    }

    // 7. Summary stats
    section('Catalog Stats');
    const stats = await query<{ category: string; cnt: number }>(`
    SELECT category, COUNT(*) as cnt FROM components GROUP BY category ORDER BY cnt DESC
  `);
    stats.forEach(s => console.log(`  ${s.category.padEnd(20)} ${s.cnt}`));

    const totalPrices = await query<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM prices`);
    console.log(`\n  Total prices: ${totalPrices[0]?.cnt ?? 0}`);

    return { passed, failed };
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log('🔧 Scrape & Validate Script');
console.log(`   Retailer: ${retailerArg}`);

try {
    await runScrape(retailerArg);
    const { passed, failed } = await validate();

    console.log(`\n${'─'.repeat(50)}`);
    console.log(`Result: ${passed} passed, ${failed} failed`);

    if (failed > 0) {
        console.log('\n⚠️  Data quality issues found. Check above.');
        process.exit(1);
    } else {
        console.log('\n✅ All checks passed.');
        process.exit(0);
    }
} catch (err) {
    console.error('\n❌ Script failed:', err instanceof Error ? err.message : String(err));
    process.exit(1);
}
