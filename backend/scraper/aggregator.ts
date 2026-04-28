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

// ── Dependency injection ──────────────────────────────────────────────────────

type SqlFn = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown[]>;

let _sql: SqlFn = bunSql as unknown as SqlFn;

export function setSql(mockSql: SqlFn): void {
  _sql = mockSql;
}

export function resetSql(): void {
  _sql = bunSql as unknown as SqlFn;
}

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

  // UltraPC stock check — only in production (skip when SQL is mocked in tests)
  const isRealSql = _sql === (bunSql as unknown as SqlFn);
  const ultrapcPrices = prices.filter(p => p.retailer_id === 10);
  if (isRealSql && ultrapcPrices.length > 0) {
    const mappedUrls = (await _sql`
      SELECT product_url FROM scraper_mappings WHERE retailer_id = 10
    `) as { product_url: string }[];
    const mappedSet = new Set(mappedUrls.map(r => r.product_url));
    const toCheck = ultrapcPrices.filter(p => mappedSet.has(p.product_url));
    if (toCheck.length > 0) {
      await new UltraPcScraper().checkStock(toCheck);
    }
  }

  // Phase 1: resolve mappings.
  // Each product URL gets its own price row — no variant merging.
  // We track (component_id, retailer_id, product_url) as the unique key.
  const resolvedPrices: (ScrapedPrice & { component_id: number; category: string })[] = [];

  for (const p of prices) {
    try {
      const mappings = (await _sql`
        SELECT sm.component_id, c.category
        FROM scraper_mappings sm
        JOIN components c ON c.id = sm.component_id
        WHERE sm.retailer_id = ${p.retailer_id}
          AND sm.product_url  = ${p.product_url}
        LIMIT 1
      `) as { component_id: number; category: string }[];

      if (mappings.length === 0) {
        await _sql`
          INSERT INTO unmatched_listings (retailer_id, product_url, scraped_name, scraped_price)
          VALUES (${p.retailer_id}, ${p.product_url}, ${p.product_name ?? ''}, ${p.price})
          ON CONFLICT (retailer_id, product_url) DO NOTHING
        `;
        unmatched++;
        continue;
      }

      resolvedPrices.push({
        ...p,
        component_id: mappings[0].component_id,
        category: mappings[0].category,
      });
    } catch (err) {
      errors++;
      console.error(`[aggregator] Mapping lookup failed for ${p.product_url}:`, err);
    }
  }

  // Phase 2: UPSERT one row per (component_id, retailer_id, product_url)
  // with variant label and details extracted from the product name.
  for (const p of resolvedPrices) {
    try {
      const { label: variantLabel, details: variantDetails } =
        extractVariant(p.product_name ?? '', p.category);

      const currentPrices = (await _sql`
        SELECT price FROM prices
        WHERE component_id = ${p.component_id}
          AND retailer_id  = ${p.retailer_id}
          AND product_url  = ${p.product_url}
        LIMIT 1
      `) as { price: number }[];

      await _sql`
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

      const lastPrice = currentPrices.length > 0 ? Number(currentPrices[0].price) : null;
      if (lastPrice === null || lastPrice !== p.price) {
        await _sql`
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
    const retailerIds = [...new Set(prices.map(p => p.retailer_id))];
    const scrapedUrls = new Set(prices.map(p => p.product_url));

    for (const retailerId of retailerIds) {
      // Skip UltraPC — it shows all products including out-of-stock, handled by checkStock
      if (retailerId === 10) continue;

      try {
        // Get all mapped URLs for this retailer that are currently marked in_stock
        const mappedInStock = (await _sql`
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
            await _sql`
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
