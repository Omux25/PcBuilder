/**
 * Aggregator — processes scraped prices using the canonical catalog model.
 *
 * For each scraped product:
 * 1. Look up scraper_mappings by (retailer_id, product_url)
 * 2. If mapping found → group by (component_id, retailer_id), pick best variant
 *    (cheapest in-stock, or cheapest out-of-stock if all variants are out)
 * 3. UPSERT the best variant into prices + record price history if changed
 * 4. If no mapping → INSERT into unmatched_listings
 *
 * For UltraPC (retailer_id=10): checks actual stock via PrestaShop AJAX
 * for mapped products only (not all 2164 scraped products).
 *
 * Requirements: 2.1, 2.2, 3.2, 4.2, 6.5
 */

import { sql as bunSql } from 'bun';
import type { ScrapedPrice } from './scrapers/baseScraper.js';
import { UltraPcScraper } from './scrapers/ultrapcScraper.js';
import { extractVariant } from '../src/utils/variantExtractor.js';
import { getSql, setSql, resetSql } from '../src/db/index.js';
import { SCRAPER_CONFIG } from '@shared/scraper-config';

// Re-export DI helpers so tests can inject a mock SQL function.
export { setSql, resetSql };

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AggregateResult {
  updated: number;
  unmatched: number;
  errors: number;
}

// ── Aggregator ────────────────────────────────────────────────────────────────

export async function aggregate(prices: ScrapedPrice[]): Promise<AggregateResult> {
  let updated   = 0;
  let unmatched = 0;
  let errors    = 0;

  if (prices.length === 0) return { updated, unmatched, errors };

  const sql = getSql();

  // isRealSql: true when running in production (real Bun.sql), false when mocked in tests.
  //
  // Why we need this: Bun.sql supports array parameters via bunSql(array) — e.g.
  //   bunSql`WHERE id IN ${bunSql([1, 2, 3])}`
  // This syntax only works with the real Bun.sql client, not with a mock function.
  // When sql is mocked in tests, we fall back to per-item queries instead.
  //
  // We also use this flag to skip the UltraPC stock check in tests (it makes real HTTP calls).
  const isRealSql = (sql as unknown) === (bunSql as unknown);

  // UltraPC stock check — only in production (skip when SQL is mocked in tests)
  const ultrapcPrices = prices.filter(p => p.retailer_id === SCRAPER_CONFIG.RETAILERS.ULTRAPC);
  if (isRealSql && ultrapcPrices.length > 0) {
    const mappedUrls = (await sql`
      SELECT product_url FROM scraper_mappings WHERE retailer_id = ${SCRAPER_CONFIG.RETAILERS.ULTRAPC}
    `) as { product_url: string }[];
    const mappedSet = new Set(mappedUrls.map(r => r.product_url));
    const toCheck = ultrapcPrices.filter(p => mappedSet.has(p.product_url));
    if (toCheck.length > 0) {
      await new UltraPcScraper().checkStock(toCheck);
    }
  }

  // Pre-fetch all mappings for the involved retailers to avoid O(N) queries.
  // Bun.sql supports array parameters via bunSql(array) — only usable with the real client.
  // When sql is mocked in tests, fall back to per-item lookup in Phase 1.
  const retailerIds = [...new Set(prices.map(p => p.retailer_id))];
  let mappingMap = new Map<string, { component_id: number; category: string }>();

  if (isRealSql) {
    try {
      const allMappings = (await bunSql`
        SELECT sm.retailer_id, sm.product_url, sm.component_id, c.category
        FROM scraper_mappings sm
        JOIN components c ON c.id = sm.component_id
        WHERE sm.retailer_id IN ${bunSql(retailerIds)}
      `) as { retailer_id: number; product_url: string; component_id: number; category: string }[];

      for (const m of allMappings) mappingMap.set(`${m.retailer_id}|${m.product_url}`, m);
    } catch {
      mappingMap = new Map(); // fall back to per-item
    }
  }

  // Phase 1: resolve mappings.
  // In production: uses the pre-fetched mappingMap (batch query above).
  // In tests (mocked SQL): mappingMap is empty, so falls back to per-item sql query.
  const resolvedPrices: (ScrapedPrice & { component_id: number; category: string })[] = [];
  for (const p of prices) {
    try {
      let mapping = mappingMap.get(`${p.retailer_id}|${p.product_url}`);

      // Per-item fallback for test mocks (mappingMap is empty when sql is mocked)
      if (!mapping && !isRealSql) {
        const rows = (await sql`
          SELECT sm.component_id, c.category
          FROM scraper_mappings sm
          JOIN components c ON c.id = sm.component_id
          WHERE sm.retailer_id = ${p.retailer_id}
            AND sm.product_url  = ${p.product_url}
          LIMIT 1
        `) as { component_id: number; category: string }[];
        if (rows.length > 0) mapping = rows[0];
      }

      if (!mapping) {
        await sql`
          INSERT INTO unmatched_listings (retailer_id, product_url, scraped_name, scraped_price)
          VALUES (${p.retailer_id}, ${p.product_url}, ${p.product_name ?? ''}, ${p.price})
          ON CONFLICT (retailer_id, product_url) DO NOTHING
        `;
        unmatched++;
        continue;
      }

      resolvedPrices.push({
        ...p,
        component_id: mapping.component_id,
        category: mapping.category,
      });
    } catch (err) {
      errors++;
      console.error(`[aggregator] Mapping lookup failed for ${p.product_url}:`, err);
    }
  }

  // Pre-fetch current prices for the resolved products to check for price drops.
  // Only in production — tests don't need this optimization.
  let priceMap = new Map<string, number>();
  if (isRealSql && resolvedPrices.length > 0) {
    try {
      const currentPrices = (await bunSql`
        SELECT component_id, retailer_id, product_url, price
        FROM prices
        WHERE retailer_id IN ${bunSql(retailerIds)}
      `) as { component_id: number; retailer_id: number; product_url: string; price: number }[];

      for (const cp of currentPrices) {
        priceMap.set(`${cp.component_id}|${cp.retailer_id}|${cp.product_url}`, Number(cp.price));
      }
    } catch {
      // Non-critical — price history deduplication will just insert every time
    }
  }

  // Phase 2: UPSERT one row per (component_id, retailer_id, product_url)
  for (const p of resolvedPrices) {
    try {
      const { label: variantLabel, details: variantDetails } =
        extractVariant(p.product_name ?? '', p.category);

      await sql`
        INSERT INTO prices (
          component_id, retailer_id, price, in_stock, product_url,
          variant_label, variant_details, last_updated
        )
        VALUES (
          ${p.component_id}, ${p.retailer_id}, ${p.price}, ${p.in_stock}, ${p.product_url},
          ${variantLabel || null},
          ${Object.keys(variantDetails).length > 0 ? variantDetails as Record<string, unknown> : null},
          NOW()
        )
        ON CONFLICT (component_id, retailer_id, product_url)
        DO UPDATE SET
          price           = EXCLUDED.price,
          in_stock        = EXCLUDED.in_stock,
          variant_label   = EXCLUDED.variant_label,
          variant_details = EXCLUDED.variant_details,
          last_updated    = NOW()
      `;

      const lastPrice = priceMap.get(`${p.component_id}|${p.retailer_id}|${p.product_url}`) ?? null;
      if (lastPrice === null || lastPrice !== p.price) {
        await sql`
          INSERT INTO price_history (component_id, retailer_id, price, in_stock)
          VALUES (${p.component_id}, ${p.retailer_id}, ${p.price}, ${p.in_stock})
        `;
      }

      updated++;
    } catch (err) {
      errors++;
      console.error(
        `[aggregator] UPSERT failed for component_id=${p.component_id} url=${p.product_url}:`,
        err,
      );
    }
  }

  // Phase 3: mark mapped products that weren't seen in this scrape as out of stock.
  // This handles retailers (like NextLevel) that only show in-stock products in listings —
  // if a product URL we have a mapping for didn't appear in the scrape, it sold out.
  if (isRealSql && prices.length > 0) {
    const scrapedUrls = new Set(prices.map(p => p.product_url));

    for (const retailerId of retailerIds) {
      // Skip UltraPC — it shows all products including out-of-stock, handled by checkStock
      if (retailerId === SCRAPER_CONFIG.RETAILERS.ULTRAPC) continue;

      try {
        // Get all mapped URLs for this retailer that are currently marked in_stock
        const mappedInStock = (await sql`
          SELECT p.product_url
          FROM prices p
          JOIN scraper_mappings sm ON sm.component_id = p.component_id
            AND sm.retailer_id = p.retailer_id
            AND sm.product_url = p.product_url
          WHERE p.retailer_id = ${retailerId}
            AND p.in_stock = true
        `) as { product_url: string }[];

        // Mark as out of stock any that weren't in this scrape
        for (const row of mappedInStock) {
          if (!scrapedUrls.has(row.product_url)) {
            await sql`
              UPDATE prices SET in_stock = false, last_updated = NOW()
              WHERE retailer_id = ${retailerId}
                AND product_url = ${row.product_url}
                AND in_stock = true
            `;
          }
        }
      } catch { /* non-critical */ }
    }
  }

  return { updated, unmatched, errors };
}
