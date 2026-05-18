/**
 * Scraping session — the core scraping logic, separated from the cron scheduler.
 * Manages the execution of multiple scrapers with concurrency control.
 *
 * Requirements: 6.6, 9.1, 9.2
 */

import PQueue from 'p-queue';
import { logger } from './utils/logger.js';
import { aggregate } from './aggregator.js';
import { runSuggestionPreprocessing } from '../services/suggestionPreprocessor.js';
import { getSql } from '../../../core/db/index.js';
import type { SqlFn } from '../../../core/db/index.js';
import { RETAILER_SCRAPERS } from './config/retailers.config.js';
import type { ResolvedRetailerScraperConfig } from './config/retailers.config.js';
import { importBenchmarks } from './benchmarkImporter.js';
import type { ScrapedPrice } from './scrapers/baseScraper.js';
import { runSmartBackfill } from '../services/enrichmentService.js';
import { runSpecMiningSession } from '../services/specMiningService.js';

// ── Data Quality Pass ─────────────────────────────────────────────────────────

/**
 * Runs after every scraping session to keep the catalog clean.
 * Fixes: miscategorized RAM, duplicate components, Intel name normalization.
 * Safe to run repeatedly — all operations are idempotent.
 */
async function runDataQualityPass(sql: SqlFn): Promise<void> {
  // 1a. Fix RAM components miscategorized as storage or psu
  await sql`
    UPDATE components SET category = 'ram'
    WHERE category IN ('storage', 'psu')
      AND (name ILIKE '%DDR4%' OR name ILIKE '%DDR5%'
        OR (name ILIKE '%MHz%' AND (name ILIKE '%GB%' OR name ILIKE '%Go%')))
  `;

  // 1b. Fix storage components miscategorized as ram (e.g. 1TB/2TB SSDs)
  await sql`
    UPDATE components SET category = 'storage', ram_type = NULL, frequency_mhz = NULL, cas_latency = NULL
    WHERE category = 'ram'
      AND (name ILIKE '%TB%' OR name ILIKE '%TO%')
      AND NOT (name ILIKE '%DDR4%' OR name ILIKE '%DDR5%' OR name ILIKE '%MHz%' OR name ILIKE '%DIMM%')
  `;

  // 1c. Fix PSU components miscategorized as motherboard
  await sql`
    UPDATE components SET category = 'psu'
    WHERE category = 'motherboard'
      AND (name ILIKE '%80PLUS%' OR name ILIKE '%80 PLUS%'
        OR name ILIKE '%Bronze%' OR name ILIKE '%Gold%' OR name ILIKE '%Platinum%'
        OR name ILIKE '%Titanium%' OR name ILIKE '%Modular%' OR name ILIKE '%PCIE5%'
        OR name ~ '[0-9]{3,4}W')
  `;

  // 1d. Fix case components miscategorized as cooling
  await sql`
    UPDATE components SET category = 'case'
    WHERE category = 'cooling'
      AND (name ILIKE '%Pure Base%' OR name ILIKE '%Shadow Base%'
        OR name ILIKE '%Silent Base%' OR name ILIKE '%Light Base%'
        OR name ILIKE '%Pure Base 500%' OR name ILIKE '%Pure Base 501%')
  `;

  // 1e. Fix fan components miscategorized as cooling (case fans)
  await sql`
    UPDATE components SET category = 'fan'
    WHERE category = 'cooling'
      AND (name ILIKE '%Pure Wings%' OR name ILIKE '%Light Wings%'
        OR name ILIKE '%Silent Wings%' OR name ILIKE '%FL12%' OR name ILIKE '%FL14%')
  `;

  // 2. Fix Intel CPU names: add "Core" prefix to bare iX names
  // e.g. "i5-12400F" -> "Core i5 12400F", "i7 13700K" -> "Core i7 13700K"
  const intelFix = await sql`
    UPDATE components
    SET name = REGEXP_REPLACE(
      REGEXP_REPLACE(name, '^([Ii])([0-9])-([0-9])', 'Core i\\2 \\3'),
      '^([Ii])([0-9])\\s+([0-9])', 'Core i\\2 \\3'
    )
    WHERE brand = 'Intel' AND (name ~ '^[Ii][0-9][-\s]' OR name ~ '^[Ii][0-9]$')
    RETURNING id
  `;
  if (intelFix.length > 0) await logger.info(`[QUALITY] Normalized ${intelFix.length} Intel CPU names`);

  // 3. Fix Intel CPU names: normalize dash to space (Core i5-14400F → Core i5 14400F)
  await sql`
    UPDATE components
    SET name = REGEXP_REPLACE(name, '(i[0-9])-([0-9])', '\\1 \\2', 'g')
    WHERE brand = 'Intel' AND name ~ 'i[0-9]-[0-9]'
  `;

  // 4. Merge exact duplicates (same brand + name + category + critical specs)
  // Keep the one with an image (or lowest ID), redirect all relations, delete the rest
  const dupes = await sql`
    SELECT array_agg(id ORDER BY
      CASE WHEN image_url IS NOT NULL THEN 0 ELSE 1 END, id ASC
    ) as ids
    FROM components WHERE is_active = true
    GROUP BY 
      LOWER(TRIM(COALESCE(brand,''))), 
      LOWER(TRIM(name)), 
      category,
      COALESCE(capacity_gb, 0),
      COALESCE(chipset, ''),
      COALESCE(ram_type, ''),
      COALESCE(frequency_mhz, 0)
    HAVING COUNT(*) > 1
  ` as { ids: number[] }[];

  if (dupes.length > 0) {
    const totalToMerge = dupes.reduce((n, g) => n + g.ids.length - 1, 0);
    await logger.info(`[QUALITY] Found ${totalToMerge} duplicate components across ${dupes.length} groups. Merging...`);
    
    for (const g of dupes) {
      const keepId = g.ids[0];
      const dupeIds = g.ids.slice(1);
      
      try {
        await sql.begin(async (tx) => {
          // 1. Handle price conflicts (delete if keepId already has a price for that retailer/url)
          await tx`
            DELETE FROM prices 
            WHERE component_id IN (${dupeIds})
              AND (retailer_id, product_url) IN (
                SELECT retailer_id, product_url FROM prices WHERE component_id = ${keepId}
              )
          `;
          await tx`UPDATE prices SET component_id = ${keepId} WHERE component_id IN (${dupeIds})`;

          // 2. Handle mapping conflicts
          await tx`
            DELETE FROM scraper_mappings 
            WHERE component_id IN (${dupeIds})
              AND (retailer_id, product_url) IN (
                SELECT retailer_id, product_url FROM scraper_mappings WHERE component_id = ${keepId}
              )
          `;
          await tx`UPDATE scraper_mappings SET component_id = ${keepId} WHERE component_id IN (${dupeIds})`;

          // 3. Redirect other relations
          await tx`UPDATE price_history SET component_id = ${keepId} WHERE component_id IN (${dupeIds})`;
          await tx`UPDATE unmatched_listings SET linked_component_id = ${keepId} WHERE linked_component_id IN (${dupeIds})`;

          // 4. Delete duplicates
          await tx`DELETE FROM components WHERE id IN (${dupeIds})`;
        });
      } catch (err) {
        await logger.error(`[QUALITY] Group merge failed for keepId ${keepId}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    await logger.info(`[QUALITY] Successfully merged duplicate components`);
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
    const exists = dbRetailers.some(r => r.id === targetRetailerId);
    if (!exists) {
      await logger.error(`[SESSION] Targeted retailer ID ${targetRetailerId} does not exist or is marked inactive`);
    } else {
      await logger.warn(`[SESSION] No scraper configuration matches retailer ID ${targetRetailerId} (verify baseUrl in retailers.config.ts matches DB)`);
    }
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

  // ── Maintenance & Enrichment Flow ──────────────────────────────────────────

  // 1. Quality Pass First: Fixes categories/names before suggestions/benchmarks run
  console.log('🧹 Running data quality pass...');
  try {
    await runDataQualityPass(sql);
  } catch (err) {
    await logger.error(`[SESSION] Data quality pass failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 2. Parallel Tasks: Suggestions, Benchmarks, and Smart Inference
  console.log('🚀 Running parallel maintenance (Suggestions, Benchmarks, Inference)...');
  await Promise.all([
    // Suggestion Preprocessing
    (async () => {
      try {
        console.log('🔍 Computing suggestions for unmatched listings...');
        await runSuggestionPreprocessing();
      } catch (err) {
        await logger.error(`[SESSION] Suggestion preprocessing failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    })(),

    // Benchmarks
    (async () => {
      try {
        console.log('📈 Updating benchmark scores...');
        const { updated: bUpdated } = await importBenchmarks();
        if (bUpdated > 0) await logger.info(`[BENCHMARKS] Updated ${bUpdated} component score(s)`);
      } catch (err) {
        await logger.error(`[SESSION] Benchmark import failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    })(),

    // Smart Backfill (Inference)
    (async () => {
      try {
        console.log('✨ Running smart spec inference...');
        await runSmartBackfill();
      } catch (err) {
        await logger.error(`[SESSION] Smart backfill failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    })()
  ]);

  // 3. Automated Spec Mining: Non-blocking (runs in background)
  console.log('Starting automated spec mining (Retailers -> Manufacturers -> Datasets)...');
  runSpecMiningSession()
    .then(() => logger.info('[SESSION] Spec mining task finished successfully'))
    .catch((err) => logger.error(`[SESSION] Spec mining task failed: ${err instanceof Error ? err.message : String(err)}`));
}


