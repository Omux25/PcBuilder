/**
 * deep-resolve-cases.ts
 *
 * Resolution script: queries all PC cases that still have NULL cooler-height
 * or NULL form-factors, then passes each product page through the Deep Scraper.
 *
 * URL resolution strategy (best → fallback):
 *   1. scraper_mappings.product_url  (direct mapped URL)
 *   2. prices.product_url            (pricing URL, usually the same page)
 *
 * Successful extractions are:
 *   - Saved to hardware_knowledge_cache (so future enrichment skips the scrape)
 *   - Written to the components table (max_cooler_height_mm, supported_motherboards, specs)
 *
 * Rate limiting: 1.5-second delay between each request to avoid IP blocks.
 */

import { getSql } from '../core/db/index.js';
import { dbHardwareCache } from '../modules/scraping/services/dynamicEnrichmentService.js';
import { scrapeProductPage } from '../modules/scraping/utils/deepScraper.js';

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

interface BrokenCase {
  id: number;
  name: string;
  brand: string;
  specs: Record<string, unknown> | null;
  max_cooler_height_mm: number | null;
  product_url: string | null;
}

async function deepResolveCases(): Promise<void> {
  const sql = getSql();

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[DeepResolve] Fetching broken cases...');

  // Fetch all cases missing cooler height OR form factors
  // Dual URL resolution: scraper_mappings preferred, prices table as fallback
  const cases = await sql`
    SELECT DISTINCT ON (c.id)
      c.id,
      c.name,
      c.brand,
      c.specs,
      c.max_cooler_height_mm,
      COALESCE(
        (SELECT sm.product_url FROM scraper_mappings sm WHERE sm.component_id = c.id LIMIT 1),
        (SELECT p.product_url  FROM prices         p  WHERE p.component_id  = c.id LIMIT 1)
      ) AS product_url
    FROM components c
    WHERE c.category = 'case'
      AND (
        c.max_cooler_height_mm IS NULL
        OR c.supported_motherboards IS NULL
        OR c.specs->>'max_cpu_cooler_height_mm' IS NULL
        OR c.specs->>'form_factors' IS NULL
      )
    ORDER BY c.id
  ` as BrokenCase[];

  const total = cases.length;
  console.log(`[DeepResolve] Found ${total} cases to heal.\n`);

  let healed = 0;
  let skippedNoUrl = 0;
  let skippedNoData = 0;

  for (const c of cases) {
    const label = `${c.brand ?? 'Unknown'} — ${c.name}`;

    if (!c.product_url) {
      console.log(`  [SKIP/NO-URL]  ${label}`);
      skippedNoUrl++;
      continue;
    }

    console.log(`  [SCRAPING]     ${label}`);
    console.log(`                 → ${c.product_url}`);

    const deepSpecs = await scrapeProductPage(c.product_url, 'case');

    if (!deepSpecs || (!deepSpecs.max_cpu_cooler_height_mm && !deepSpecs.form_factors)) {
      console.log(`  [FAILED]       No extractable specs found on page.\n`);
      skippedNoData++;
    } else {
      // Merge with existing specs JSONB
      let currentSpecs: Record<string, unknown> = {};
      if (c.specs) {
        currentSpecs = typeof c.specs === 'string'
          ? (() => { try { return JSON.parse(c.specs as string); } catch { return {}; } })()
          : (c.specs as Record<string, unknown>);
      }

      const final_cooler_height = deepSpecs.max_cpu_cooler_height_mm
        ?? (currentSpecs.max_cpu_cooler_height_mm as number | null)
        ?? c.max_cooler_height_mm;

      const final_form_factors: string[] | null = deepSpecs.form_factors
        ?? (currentSpecs.form_factors as string[] | null)
        ?? null;

      const specsPayload = {
        ...currentSpecs,
        max_cpu_cooler_height_mm: final_cooler_height,
        form_factors: final_form_factors,
      };

      const cachePayload = {
        max_cpu_cooler_height_mm: final_cooler_height,
        form_factors: final_form_factors,
      };

      // Persist to knowledge cache so future enrichment is instant
      await dbHardwareCache.set(c.name, 'case', cachePayload);

      // Persist to components table — use the same array literal syntax as
      // catalogBuilder.ts so Bun's postgres driver serialises it correctly
      const arrayLiteral = final_form_factors
        ? `{${final_form_factors.join(',')}}`
        : null;

      await sql`
        UPDATE components
        SET
          max_cooler_height_mm   = ${final_cooler_height},
          supported_motherboards = ${arrayLiteral}::character varying[],
          specs                  = ${specsPayload as any},
          updated_at             = NOW()
        WHERE id = ${c.id}
      `;

      console.log(`  [HEALED ✓]     Cooler: ${final_cooler_height ?? 'n/a'} mm | Forms: ${final_form_factors?.join(', ') ?? 'n/a'}\n`);
      healed++;
    }

    // Respectful delay between page fetches to avoid IP blocking
    await delay(1_500);
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[DeepResolve] COMPLETE');
  console.log(`  Total found   : ${total}`);
  console.log(`  Healed        : ${healed}`);
  console.log(`  No URL        : ${skippedNoUrl}`);
  console.log(`  No data found : ${skippedNoData}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

deepResolveCases()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('[DeepResolve] Fatal error:', err);
    process.exit(1);
  });
