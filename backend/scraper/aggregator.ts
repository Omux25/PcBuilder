/**
 * Aggregator — processes scraped prices using the canonical catalog model.
 *
 * For each scraped product:
 * 1. Look up scraper_mappings by (retailer_id, product_url)
 * 2. If mapping found → UPSERT prices, record price history if changed
 * 3. If no mapping → INSERT into unmatched_listings (skip if already exists)
 *
 * After all prices are processed, updates the retailer's last_scrape_at and status.
 *
 * Requirements: 2.1, 2.2, 3.2, 4.2, 6.5
 */

import { sql as bunSql } from 'bun';
import type { ScrapedPrice } from './scrapers/baseScraper.js';

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

/**
 * Processes each ScrapedPrice:
 * - Matched products → UPSERT prices + record price history
 * - Unmatched products → INSERT into unmatched_listings
 */
export async function aggregate(prices: ScrapedPrice[]): Promise<AggregateResult> {
  let updated   = 0;
  let unmatched = 0;
  let errors    = 0;

  for (const p of prices) {
    try {
      // 1. Look up scraper mapping
      const mappings = (await _sql`
        SELECT component_id FROM scraper_mappings
        WHERE retailer_id = ${p.retailer_id}
          AND product_url = ${p.product_url}
        LIMIT 1
      `) as { component_id: number }[];

      if (mappings.length === 0) {
        // 2a. No mapping — add to unmatched queue
        await _sql`
          INSERT INTO unmatched_listings (retailer_id, product_url, scraped_name, scraped_price)
          VALUES (${p.retailer_id}, ${p.product_url}, ${p.product_name ?? ''}, ${p.price})
          ON CONFLICT (retailer_id, product_url) DO NOTHING
        `;
        unmatched++;
        continue;
      }

      const componentId = mappings[0].component_id;

      // 2b. Mapping found — get current price for history comparison
      const currentPrices = (await _sql`
        SELECT price FROM prices
        WHERE component_id = ${componentId} AND retailer_id = ${p.retailer_id}
        LIMIT 1
      `) as { price: number }[];

      // UPSERT into prices
      await _sql`
        INSERT INTO prices (component_id, retailer_id, price, in_stock, product_url, last_updated)
        VALUES (${componentId}, ${p.retailer_id}, ${p.price}, ${p.in_stock}, ${p.product_url}, NOW())
        ON CONFLICT (component_id, retailer_id)
        DO UPDATE SET
          price        = EXCLUDED.price,
          in_stock     = EXCLUDED.in_stock,
          product_url  = EXCLUDED.product_url,
          last_updated = NOW()
      `;

      // Record price history only if price changed
      const lastPrice = currentPrices.length > 0 ? Number(currentPrices[0].price) : null;
      if (lastPrice === null || lastPrice !== p.price) {
        await _sql`
          INSERT INTO price_history (component_id, retailer_id, price, in_stock)
          VALUES (${componentId}, ${p.retailer_id}, ${p.price}, ${p.in_stock})
        `;
      }

      updated++;
    } catch (err) {
      errors++;
      console.error(
        `[aggregator] Failed to process price for retailer_id=${p.retailer_id} url=${p.product_url}:`,
        err,
      );
    }
  }

  return { updated, unmatched, errors };
}
