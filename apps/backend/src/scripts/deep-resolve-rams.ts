/**
 * deep-resolve-rams.ts
 *
 * Resolution script: queries all RAM components that still have NULL cas_latency,
 * then passes each product page through the Deep Scraper.
 *
 * URL resolution strategy (best → fallback):
 *   1. scraper_mappings.product_url  (direct mapped URL)
 *   2. prices.product_url            (pricing URL, usually the same page)
 *
 * Successful extractions are:
 *   - Saved to hardware_knowledge_cache (so future enrichment skips the scrape)
 *   - Written to the components table (cas_latency, kit_count, ram_type)
 *
 * Rate limiting: 1.5-second delay between each request to avoid IP blocks.
 */

import { getSql } from '../core/db/index.js';
import { dbHardwareCache } from '../modules/scraping/services/dynamicEnrichmentService.js';
import { scrapeProductPage } from '../modules/scraping/utils/deepScraper.js';

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

interface BrokenRam {
  id: number;
  name: string;
  brand: string;
  ram_type: string | null;
  kit_count: number | null;
  cas_latency: number | null;
  product_url: string | null;
}

async function deepResolveRams(): Promise<void> {
  const sql = getSql();

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[DeepResolveRAM] Fetching RAM components with missing CAS Latency...');

  // Fetch all RAM components missing cas_latency
  const rams = await sql`
    SELECT DISTINCT ON (c.id)
      c.id,
      c.name,
      c.brand,
      c.ram_type,
      c.kit_count,
      c.cas_latency,
      COALESCE(
        (SELECT sm.product_url FROM scraper_mappings sm WHERE sm.component_id = c.id LIMIT 1),
        (SELECT p.product_url  FROM prices         p  WHERE p.component_id  = c.id LIMIT 1)
      ) AS product_url
    FROM components c
    WHERE c.category = 'ram'
      AND c.cas_latency IS NULL
    ORDER BY c.id
  ` as BrokenRam[];

  const total = rams.length;
  console.log(`[DeepResolveRAM] Found ${total} RAM components to heal.\n`);

  let healed = 0;
  let skippedNoUrl = 0;
  let skippedNoData = 0;

  for (const r of rams) {
    const label = `${r.brand ?? 'Unknown'} — ${r.name}`;

    if (!r.product_url) {
      console.log(`  [SKIP/NO-URL]  ${label}`);
      skippedNoUrl++;
      continue;
    }

    console.log(`  [SCRAPING]     ${label}`);
    console.log(`                 → ${r.product_url}`);

    const deepSpecs = await scrapeProductPage(r.product_url, 'ram');

    if (!deepSpecs || !deepSpecs.cas_latency) {
      console.log(`  [FAILED]       No extractable CAS Latency found on page.\n`);
      skippedNoData++;
    } else {
      const final_cas_latency = deepSpecs.cas_latency;
      const final_kit_count = (deepSpecs.kit_count as number | null) ?? r.kit_count ?? 1;
      const final_ram_type = (deepSpecs.ram_type as string | null) ?? r.ram_type;

      const cachePayload = {
        cas_latency: final_cas_latency,
        kit_count: final_kit_count,
        ram_type: final_ram_type,
      };

      // Persist to knowledge cache so future enrichment is instant
      await dbHardwareCache.set(r.name, 'ram', cachePayload);

      // Persist to components table
      await sql`
        UPDATE components
        SET
          cas_latency = ${final_cas_latency},
          kit_count = ${final_kit_count},
          ram_type = ${final_ram_type},
          updated_at = NOW()
        WHERE id = ${r.id}
      `;

      console.log(`  [HEALED ✓]     CL: ${final_cas_latency} | Kit: ${final_kit_count}x | Type: ${final_ram_type ?? 'n/a'}\n`);
      healed++;
    }

    // Respectful delay between page fetches to avoid IP blocking
    await delay(1_500);
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[DeepResolveRAM] COMPLETE');
  console.log(`  Total found   : ${total}`);
  console.log(`  Healed        : ${healed}`);
  console.log(`  No URL        : ${skippedNoUrl}`);
  console.log(`  No data found : ${skippedNoData}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

deepResolveRams()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('[DeepResolveRAM] Fatal error:', err);
    process.exit(1);
  });
