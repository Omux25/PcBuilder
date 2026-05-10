/**
 * Scraping session — the core scraping logic, separated from the cron scheduler.
 * Manages the execution of multiple scrapers with concurrency control.
 *
 * Requirements: 6.6, 9.1, 9.2
 */

import PQueue from 'p-queue';
import { logger } from './utils/logger.js';
import { aggregate } from './aggregator.js';
import { runSuggestionPreprocessing } from '../src/services/suggestionPreprocessor.js';
import { getSql } from '../src/db/index.js';
import type { SqlFn } from '../src/db/index.js';
import { RETAILER_SCRAPERS } from './config/retailers.config.js';
import type { ResolvedRetailerScraperConfig } from './config/retailers.config.js';
import { importBenchmarks } from './benchmarkImporter.js';
import type { ScrapedPrice } from './scrapers/baseScraper.js';

// ── Data Quality Pass ─────────────────────────────────────────────────────────

/**
 * Runs after every scraping session to keep the catalog clean.
 * Fixes: miscategorized RAM, duplicate components, Intel name normalization.
 * Safe to run repeatedly — all operations are idempotent.
 */
async function runDataQualityPass(sql: SqlFn): Promise<void> {
  // 1. Fix RAM components miscategorized as storage or psu
  await sql`
    UPDATE components SET category = 'ram'
    WHERE category IN ('storage', 'psu')
      AND (name ILIKE '%DDR4%' OR name ILIKE '%DDR5%'
        OR (name ILIKE '%MHz%' AND (name ILIKE '%GB%' OR name ILIKE '%Go%')))
  `;

  // 1b. Fix PSU components miscategorized as motherboard
  await sql`
    UPDATE components SET category = 'psu'
    WHERE category = 'motherboard'
      AND (name ILIKE '%80PLUS%' OR name ILIKE '%80 PLUS%'
        OR name ILIKE '%Bronze%' OR name ILIKE '%Gold%' OR name ILIKE '%Platinum%'
        OR name ILIKE '%Titanium%' OR name ILIKE '%Modular%' OR name ILIKE '%PCIE5%'
        OR name ~ '[0-9]{3,4}W')
  `;

  // 1c. Fix case components miscategorized as cooling
  await sql`
    UPDATE components SET category = 'case'
    WHERE category = 'cooling'
      AND (name ILIKE '%Pure Base%' OR name ILIKE '%Shadow Base%'
        OR name ILIKE '%Silent Base%' OR name ILIKE '%Light Base%'
        OR name ILIKE '%Pure Base 500%' OR name ILIKE '%Pure Base 501%')
  `;

  // 1d. Fix fan components miscategorized as cooling (case fans)
  await sql`
    UPDATE components SET category = 'fan'
    WHERE category = 'cooling'
      AND (name ILIKE '%Pure Wings%' OR name ILIKE '%Light Wings%'
        OR name ILIKE '%Silent Wings%' OR name ILIKE '%FL12%' OR name ILIKE '%FL14%')
  `;

  // 2. Fix Intel CPU names: add "Core" prefix to bare iX names
  const bareIntel = await sql`
    SELECT id, name FROM components
    WHERE brand = 'Intel' AND (name ~ '^[Ii][0-9][-\s]' OR name ~ '^[Ii][0-9]$')
  ` as { id: number; name: string }[];
  for (const c of bareIntel) {
    const fixed = c.name
      .replace(/^([Ii])([0-9])-([0-9])/g, 'Core i$2 $3')
      .replace(/^([Ii])([0-9])\s+([0-9])/g, 'Core i$2 $3');
    if (fixed !== c.name) await sql`UPDATE components SET name = ${fixed} WHERE id = ${c.id}`;
  }

  // 3. Fix Intel CPU names: normalize dash to space (Core i5-14400F → Core i5 14400F)
  await sql`
    UPDATE components
    SET name = REGEXP_REPLACE(name, '(i[0-9])-([0-9])', '\\1 \\2', 'g')
    WHERE brand = 'Intel' AND name ~ 'i[0-9]-[0-9]'
  `;

  // 4. Merge exact duplicates (same brand + name, case-insensitive)
  // Keep the one with an image (or lowest ID), redirect all relations, delete the rest
  const dupes = await sql`
    SELECT array_agg(id ORDER BY
      CASE WHEN image_url IS NOT NULL THEN 0 ELSE 1 END, id ASC
    ) as ids
    FROM components WHERE is_active = true
    GROUP BY LOWER(TRIM(COALESCE(brand,''))), LOWER(TRIM(name))
    HAVING COUNT(*) > 1
  ` as { ids: number[] }[];

  for (const g of dupes) {
    const keepId = g.ids[0];
    for (const dupeId of g.ids.slice(1)) {
      try {
        await sql`DELETE FROM prices WHERE component_id = ${dupeId} AND product_url IN (SELECT product_url FROM prices WHERE component_id = ${keepId})`;
        await sql`UPDATE prices SET component_id = ${keepId} WHERE component_id = ${dupeId}`;
        await sql`DELETE FROM scraper_mappings WHERE component_id = ${dupeId} AND product_url IN (SELECT product_url FROM scraper_mappings WHERE component_id = ${keepId})`;
        await sql`UPDATE scraper_mappings SET component_id = ${keepId} WHERE component_id = ${dupeId}`;
        await sql`UPDATE price_history SET component_id = ${keepId} WHERE component_id = ${dupeId}`;
        await sql`UPDATE unmatched_listings SET linked_component_id = ${keepId} WHERE linked_component_id = ${dupeId}`;
        await sql`DELETE FROM components WHERE id = ${dupeId}`;
      } catch { /* skip individual merge errors */ }
    }
  }

  if (dupes.length > 0) {
    await logger.info(`[QUALITY] Merged ${dupes.reduce((n, g) => n + g.ids.length - 1, 0)} duplicate components`);
  }
}

/**
 * Runs a full or partial scraping session.
 *
 * @param targetRetailerId - If provided, only run the scraper for this specific retailer.
 */
export async function runScrapingSession(targetRetailerId?: number): Promise<void> {
  const sql = getSql();

  // Normalize a URL to just its origin (scheme + hostname, no path, no trailing slash).
  // e.g. "https://setupgame.ma/components" → "https://setupgame.ma"
  //      "https://www.ultrapc.ma/"         → "https://www.ultrapc.ma"
  function normalizeUrl(url: string): string {
    try {
      const { origin } = new URL(url.startsWith('http') ? url : `https://${url}`);
      return origin;
    } catch {
      return url.replace(/\/+$/, ''); // fallback: just strip trailing slashes
    }
  }

  // Resolve retailer IDs dynamically from the DB by base_url.
  // base_url is the stable identifier — tied to the domain the scraper was written for.
  // Both sides are normalized to origin so trailing slashes and paths don't cause mismatches.
  const dbRetailers = await sql`
    SELECT id, base_url FROM retailers WHERE is_active = true
  ` as { id: number; base_url: string }[];

  const urlToId = new Map(dbRetailers.map(r => [normalizeUrl(r.base_url), r.id]));

  const resolvedScrapers: ResolvedRetailerScraperConfig[] = [];
  for (const config of RETAILER_SCRAPERS) {
    const id = urlToId.get(normalizeUrl(config.baseUrl));
    if (id === undefined) {
      // Only warn if doing a full session — in a targeted session, missing unrelated scrapers is expected/noise.
      if (!targetRetailerId) {
        await logger.warn(`[SESSION] Retailer "${config.baseUrl}" not found in DB — skipping scraper`);
      }
      continue;
    }
    resolvedScrapers.push({ ...config, retailer_id: id });
  }

  const allPrices: ScrapedPrice[] = [];
  const queue = new PQueue({ concurrency: 4 }); // one slot per retailer — all run in parallel

  const scrapersToRun = targetRetailerId
    ? resolvedScrapers.filter(s => s.retailer_id === targetRetailerId)
    : resolvedScrapers;

  if (scrapersToRun.length === 0 && targetRetailerId) {
    await logger.warn(`[SESSION] No scraper registered for retailer ID ${targetRetailerId}`);
    return;
  }

  const targetName = targetRetailerId
    ? scrapersToRun[0]?.name ?? `Retailer ${targetRetailerId}`
    : 'Full';
  const sessionType = targetRetailerId ? `Targeted (${targetName})` : 'Full';

  console.log(`📡 Scraping session: ${sessionType}`);
  console.log(`   Retailers to scrape: ${scrapersToRun.length}\n`);

  await logger.info(`[SESSION] Scraping session started: ${sessionType}`);

  const scraperResults = new Map<number, 'SUCCESS' | 'FAILED'>();

  await Promise.all(scrapersToRun.map(config =>
    queue.add(async () => {
      try {
        console.log(`🔄 [${config.name}] Starting scrape...`);
        await logger.info(`[${config.name}] Scraper started`, config.name);
        const prices = await config.run(config.retailer_id);
        allPrices.push(...prices);
        console.log(`✅ [${config.name}] Scraped ${prices.length} products`);
        await logger.info(`[${config.name}] Successfully scraped ${prices.length} product(s)`, config.name);
        scraperResults.set(config.retailer_id, 'SUCCESS');
      } catch (err) {
        console.error(`❌ [${config.name}] Failed: ${err instanceof Error ? err.message : String(err)}`);
        await logger.error(
          `[${config.name}] Scraper failed: ${err instanceof Error ? err.message : String(err)}`,
          config.name
        );
        scraperResults.set(config.retailer_id, 'FAILED');
      }
    })
  ));

  for (const [retailerId, status] of scraperResults) {
    try {
      await sql`
        UPDATE retailers
        SET last_scrape_at = NOW(), last_scrape_status = ${status}
        WHERE id = ${retailerId}
      `;
    } catch { /* non-critical */ }
  }

  if (allPrices.length === 0) {
    console.log('\n⚠️  No prices scraped');
    await logger.info('[SESSION] Scraping complete: 0 updated, 0 unmatched, 0 errors');
    return;
  }

  console.log(`\n📊 Processing ${allPrices.length} listings through pipeline...`);
  await logger.info(`[SESSION] Processing ${allPrices.length} listing(s) through unified pipeline...`);

  let lastReported = 0;
  const PROGRESS_INTERVAL = 500;

  const { updated, unmatched, errors, autoMapped, autoCreated } = await aggregate(allPrices, urlToId, {}, async (done, total) => {
    if (done - lastReported >= PROGRESS_INTERVAL || done === total) {
      const pct = Math.round((done / total) * 100);
      await logger.info(`[SESSION] Pipeline progress: ${done}/${total} (${pct}%)`);
      lastReported = done;
    }
  });

  console.log(`\n✅ Pipeline complete:`);
  console.log(`   Prices updated: ${updated}`);
  console.log(`   Auto-mapped: ${autoMapped}`);
  console.log(`   Auto-created: ${autoCreated}`);
  console.log(`   Unmatched: ${unmatched}`);
  if (errors > 0) console.log(`   Errors: ${errors}`);

  await logger.info(`[SESSION] Pipeline done — ${updated} prices updated, ${autoMapped} auto-mapped, ${autoCreated} auto-created, ${unmatched} unmatched`);

  // Pre-compute suggestions for all remaining pending listings
  console.log('\n🔍 Computing suggestions for unmatched listings...');
  await logger.info('[SESSION] Computing suggestions for unmatched listings...');
  await runSuggestionPreprocessing();

  // Auto-update benchmark scores after each session — keeps scores current
  // as new components are added to the catalog by the catalog builder.
  console.log('📈 Updating benchmark scores...');
  await logger.info('[SESSION] Updating benchmark scores...');
  try {
    const { updated: bUpdated } = await importBenchmarks();
    if (bUpdated > 0) {
      console.log(`   Updated ${bUpdated} benchmark scores`);
      await logger.info(`[BENCHMARKS] Updated ${bUpdated} component score(s)`);
    }
  } catch { /* non-critical — benchmark import failure must not crash the session */ }

  // Post-pipeline data quality pass — only in production (real DB connection).
  // Fixes miscategorized components, duplicate entries, Intel name normalization.
  if (allPrices.length > 0) {
    console.log('🧹 Running data quality pass...');
    try {
      await runDataQualityPass(sql);
    } catch (err) {
      await logger.error(`[SESSION] Data quality pass failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Image gap fill — use the already-scraped prices to fill any components
    // that still have no image after the aggregator's backfill phase.
    // This catches components that were DNA-matched (not unmatched) and whose
    // retailer URL wasn't in the aggregator's imageUpdates map.
    console.log('🖼️  Filling image gaps from scraped data...');
    try {
      const { sql: bunSqlDirect } = await import('bun');
      // Build URL → image map from all scraped prices
      const imageByUrl = new Map<string, { url: string; score: number }>();
      for (const p of allPrices) {
        if (!p.image_url || !p.product_url) continue;
        const urlLower = p.image_url.toLowerCase();
        let score = 50;
        if (urlLower.includes('mpk') || urlLower.includes('bundle')) score -= 30;
        if (urlLower.includes('placeholder') || urlLower.includes('no-image')) score = -100;
        if (score < 0) continue;
        const existing = imageByUrl.get(p.product_url);
        if (!existing || score > existing.score) imageByUrl.set(p.product_url, { url: p.image_url, score });
      }

      // Find all components without images that have a mapping in our scraped URLs
      const mappings = await bunSqlDirect`
        SELECT sm.component_id, sm.product_url, c.name
        FROM scraper_mappings sm
        JOIN components c ON c.id = sm.component_id
        WHERE c.image_url IS NULL AND c.is_active = true
      ` as { component_id: number; product_url: string; name: string }[];

      // Pick best image per component
      const best = new Map<number, string>();
      for (const m of mappings) {
        const img = imageByUrl.get(m.product_url);
        if (img) best.set(m.component_id, img.url);
      }

      let filled = 0;
      for (const [id, url] of best) {
        await bunSqlDirect`UPDATE components SET image_url = ${url} WHERE id = ${id} AND image_url IS NULL`;
        filled++;
      }
      if (filled > 0) {
        console.log(`   Filled ${filled} missing images`);
        await logger.info(`[SESSION] Image gap fill: ${filled} components updated`);
      }
    } catch (err) {
      await logger.error(`[SESSION] Image gap fill failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
