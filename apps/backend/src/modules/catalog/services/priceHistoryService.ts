/**
 * Price History Service
 * Records price changes over time and retrieves historical price data.
 *
 * Requirements: 3.1, 3.2, 3.3
 */

import { getSql } from '../../../core/db/index.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface PriceHistoryEntry {
  id: number;
  component_id: number;
  retailer_id: number;
  retailer_name: string;
  price: number;
  in_stock: boolean;
  recorded_at: string;
}

// ── Service Functions ────────────────────────────────────────────────────────

export class PriceHistoryService {
  /**
   * Returns price history for a component aggregated to one data point per day per retailer.
   * Aggregation prevents chart noise from multiple scrapes per day.
   *
   * @param componentId - The component's primary key
   * @param retailerId  - Optional: filter to a single retailer
   * @param days        - Number of past days to include (default 30)
   */
  async getPriceHistory(
    componentId: number,
    retailerId?: number,
    days: number = 30
  ): Promise<PriceHistoryEntry[]> {
    const sql = getSql();
    // Aggregate to one row per (day, retailer) — MIN price for that day.
    // This eliminates chart noise from multiple scrapes per day while preserving
    // the lowest price seen (most useful for the user).
    return sql`
      SELECT
        MIN(ph.id)                                    AS id,
        ph.component_id,
        ph.retailer_id,
        r.name                                        AS retailer_name,
        MIN(ph.price)                                 AS price,
        BOOL_OR(ph.in_stock)                          AS in_stock,
        DATE_TRUNC('day', ph.recorded_at)::timestamptz AS recorded_at
      FROM price_history ph
      JOIN retailers r ON r.id = ph.retailer_id
      WHERE ph.component_id = ${componentId}
        AND (${retailerId ?? null}::int IS NULL OR ph.retailer_id = ${retailerId ?? null})
        AND ph.recorded_at >= NOW() - (${days} || ' days')::INTERVAL
      GROUP BY ph.component_id, ph.retailer_id, r.name, DATE_TRUNC('day', ph.recorded_at)
      ORDER BY recorded_at ASC
    ` as Promise<PriceHistoryEntry[]>;
  }

  /**
   * Records a price change in price_history — only if the price differs from
   * the most recent recorded price for this (component, retailer) pair.
   *
   * Note: the aggregator does its own inline price history insert with a
   * pre-fetched price map for efficiency. This function is available for
   * use cases that need single-record deduplication (e.g. scripts, tests).
   *
   * @param componentId - The component's primary key
   * @param retailerId  - The retailer's primary key
   * @param price       - The new scraped price
   * @param inStock     - Whether the product is currently in stock
   * @returns true if a new history row was inserted, false if price was unchanged
   */
  async recordPriceChange(
    componentId: number,
    retailerId: number,
    price: number,
    inStock: boolean
  ): Promise<boolean> {
    const sql = getSql();
    const recent = (await sql`
      SELECT price FROM price_history
      WHERE component_id = ${componentId}
        AND retailer_id  = ${retailerId}
      ORDER BY recorded_at DESC
      LIMIT 1
    `) as { price: number }[];

    const lastPrice = recent.length > 0 ? Number(recent[0].price) : null;
    if (lastPrice !== null && lastPrice === price) {
      return false;
    }

    await sql`
      INSERT INTO price_history (component_id, retailer_id, price, in_stock)
      VALUES (${componentId}, ${retailerId}, ${price}, ${inStock})
    `;

    return true;
  }
}

// Re-export as functional API for backward compatibility if needed
const service = new PriceHistoryService();
export const getPriceHistory = service.getPriceHistory.bind(service);
export const recordPriceChange = service.recordPriceChange.bind(service);
