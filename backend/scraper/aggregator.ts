/**
 * Aggregator — UPSERTs scraped prices into the `prices` table.
 *
 * Takes all ScrapedPrice[] results from every scraper and writes them to the
 * database using INSERT ... ON CONFLICT DO UPDATE (UPSERT).
 *
 * The UNIQUE constraint on (component_id, retailer_id) is the conflict target:
 * - If the row doesn't exist → INSERT
 * - If it already exists → UPDATE price, in_stock, product_url, last_updated
 *
 * Usage:
 *   const { updated, errors } = await aggregate(allPrices);
 *
 * Requirements: 6.5, 7.2
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
  /** Number of rows successfully inserted or updated. */
  updated: number;
  /** Number of rows that failed (DB error, invalid FK, etc.). */
  errors: number;
}

// ── Aggregator ────────────────────────────────────────────────────────────────

/**
 * UPSERTs each ScrapedPrice into the `prices` table.
 *
 * Each row is processed individually so one bad record doesn't abort the rest.
 * Returns a summary of how many rows succeeded and how many failed.
 *
 * @param prices - All scraped price records from all scrapers
 */
export async function aggregate(prices: ScrapedPrice[]): Promise<AggregateResult> {
  let updated = 0;
  let errors  = 0;

  for (const p of prices) {
    try {
      await _sql`
        INSERT INTO prices (component_id, retailer_id, price, in_stock, product_url, last_updated)
        VALUES (${p.component_id}, ${p.retailer_id}, ${p.price}, ${p.in_stock}, ${p.product_url}, NOW())
        ON CONFLICT (component_id, retailer_id)
        DO UPDATE SET
          price        = EXCLUDED.price,
          in_stock     = EXCLUDED.in_stock,
          product_url  = EXCLUDED.product_url,
          last_updated = NOW()
      `;
      updated++;
    } catch (err) {
      errors++;
      console.error(
        `[aggregator] Failed to upsert price for component_id=${p.component_id} retailer_id=${p.retailer_id}:`,
        err,
      );
    }
  }

  return { updated, errors };
}
