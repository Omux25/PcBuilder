/**
 * scrape_and_validate.ts - Standalone scrape + data quality check script.
 *
 * Usage:
 *   bun scripts/tools/scrape_and_validate.ts
 *   bun scripts/tools/scrape_and_validate.ts --retailer=ultrapc
 *   bun scripts/tools/scrape_and_validate.ts --retailer=all
 */

import { sql } from 'bun';
import { runScrapingSession } from '../../scraper/session.js';

const args = process.argv.slice(2);
const retailerArg = args.find(a => a.startsWith('--retailer='))?.split('=')[1]
    ?? args[args.indexOf('--retailer') + 1]
    ?? 'ultrapc';

async function q<T>(query: string): Promise<T[]> {
    return sql.unsafe(query) as Promise<T[]>;
}

const pass = (msg: string) => console.log('  \u2705 ' + msg);
const fail = (msg: string) => console.log('  \u274C ' + msg);
const warn = (msg: string) => console.log('  \u26A0\uFE0F  ' + msg);
const section = (msg: string) => console.log('\n\u2500\u2500 ' + msg + ' \u2500\u2500');

async function getRetailerId(name: string): Promise<number | undefined> {
    const rows = await q<{ id: number }>(
        "SELECT id FROM retailers WHERE LOWER(name) LIKE LOWER('%" + name + "%') AND is_active = true LIMIT 1"
    );
    return rows[0]?.id;
}

async function runScrape(retailer: string): Promise<void> {
    if (retailer === 'all') {
        console.log('\n Running full scrape...');
        await runScrapingSession();
    } else {
        const id = await getRetailerId(retailer);
        if (!id) { console.error('Retailer "' + retailer + '" not found'); process.exit(1); }
        console.log('\n Targeted scrape: ' + retailer + ' (id=' + id + ')...');
        await runScrapingSession(id);
    }
}

async function validate(): Promise<{ passed: number; failed: number }> {
    let passed = 0;
    let failed = 0;

    section('Data Quality Checks');

    // 1. Junk CPU entries
    const junkCpus = await q<{ id: number; brand: string; name: string }>(
        "SELECT id, brand, name FROM components WHERE category = 'cpu' AND (" +
        "name ILIKE '%cœur%' OR " +
        "(name ILIKE '%thread%' AND name NOT ILIKE '%threadripper%') OR " +
        "brand ILIKE '%thermal%' OR " +
        "name ILIKE '%grizzly%' OR " +
        "name ILIKE '%direct die%' OR " +
        "name ILIKE '%GHz%')"
    );
    if (junkCpus.length === 0) { pass('No junk CPU entries'); passed++; }
    else {
        fail(junkCpus.length + ' junk CPU entries:');
        junkCpus.forEach(c => console.log('     [' + c.id + '] ' + c.brand + ' / ' + c.name));
        failed++;
    }

    // 2. UltraPC HEDT coverage
    const ultrapcId = await getRetailerId('ultrapc');
    if (ultrapcId) {
        const hedt = await q<{ product_url: string }>(
            "SELECT product_url FROM scraper_mappings WHERE retailer_id = " + ultrapcId +
            " AND (product_url LIKE '%swrx8%' OR product_url LIKE '%socket-amd-tr4%' OR product_url LIKE '%socket-2066%') LIMIT 5"
        );
        if (hedt.length > 0) { pass('UltraPC HEDT: ' + hedt.length + ' product(s) mapped'); passed++; }
        else { warn('UltraPC HEDT sub-categories not scraped'); }
        const cnt = await q<{ cnt: number }>(
            "SELECT COUNT(DISTINCT product_url) as cnt FROM scraper_mappings WHERE retailer_id = " + ultrapcId
        );
        console.log('     UltraPC total: ' + (cnt[0]?.cnt ?? 0) + ' mapped');
    }

    // 3. Duplicates
    const dupes = await q<{ cnt: number }>(
        "SELECT COUNT(*) as cnt FROM (" +
        "SELECT 1 FROM components WHERE is_active = true " +
        "GROUP BY LOWER(TRIM(COALESCE(brand,''))), LOWER(TRIM(name)) " +
        "HAVING COUNT(*) > 1) sub"
    );
    const dupeCount = Number(dupes[0]?.cnt ?? 0);
    if (dupeCount === 0) { pass('No duplicate components'); passed++; }
    else { fail(dupeCount + ' duplicate groups'); failed++; }

    // 4. Unmatched count
    const unmatched = await q<{ cnt: number }>(
        "SELECT COUNT(*) as cnt FROM unmatched_listings WHERE status = 'pending'"
    );
    const unmatchedCount = Number(unmatched[0]?.cnt ?? 0);
    if (unmatchedCount < 300) { pass('Unmatched: ' + unmatchedCount + ' (acceptable)'); passed++; }
    else { warn('Unmatched: ' + unmatchedCount + ' (high)'); }

    // 5. Stats
    section('Catalog Stats');
    const stats = await q<{ category: string; cnt: number }>(
        "SELECT category, COUNT(*) as cnt FROM components GROUP BY category ORDER BY cnt DESC"
    );
    stats.forEach(s => console.log('  ' + s.category.padEnd(20) + ' ' + s.cnt));
    const prices = await q<{ cnt: number }>("SELECT COUNT(*) as cnt FROM prices");
    console.log('\n  Total prices: ' + (prices[0]?.cnt ?? 0));

    return { passed, failed };
}

console.log('Scrape & Validate');
console.log('   Retailer: ' + retailerArg);

try {
    await runScrape(retailerArg);
    const { passed, failed } = await validate();
    console.log('\n' + '-'.repeat(50));
    console.log('Result: ' + passed + ' passed, ' + failed + ' failed');
    if (failed > 0) { console.log('\nIssues found.'); process.exit(1); }
    else { console.log('\nAll checks passed.'); process.exit(0); }
} catch (err) {
    console.error('\nFailed:', err instanceof Error ? err.message : String(err));
    process.exit(1);
}
