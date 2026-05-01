/**
 * Price History Service
 * Records price changes over time and retrieves historical price data.
 *
 * Requirements: 3.1, 3.2, 3.3
 */

import { getSql } from '../db/index.js';

// Re-export DI helpers from centralized module for test compatibility
export { setSql, resetSql } from '../db/index.js';

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

/**
 * Returns price history for a component, optionally filtered by retailer and time range.
 *
 * @param componentId - The component's primary key
 * @param retailerId  - Optional: filter to a single retailer
 * @param days        - Optional: number of past days to include (default 30)
 */
async function getPriceHistory(
  componentId: number,
  retailerId?: number,
  days: number = 30
): Promise<PriceHistoryEntry[]> {
  const sql = getSql();
  // Single query with nullable retailer filter — avoids duplicating the SQL.
  return sql`
    SELECT
      ph.id,
      ph.component_id,
      ph.retailer_id,
      r.name AS retailer_name,
      ph.price,
      ph.in_stock,
      ph.recorded_at
    FROM price_history ph
    JOIN retailers r ON r.id = ph.retailer_id
    WHERE ph.component_id = ${componentId}
      AND (${retailerId ?? null}::int IS NULL OR ph.retailer_id = ${retailerId ?? null})
      AND ph.recorded_at >= NOW() - (${days} || ' days')::INTERVAL
    ORDER BY ph.recorded_at ASC
  ` as Promise<PriceHistoryEntry[]>;
}

/**
 * Records a price change in price_history — only if the price differs from
 * the most recent recorded price for this (component, retailer) pair.
 *
 * @param componentId - The component's primary key
 * @param retailerId  - The retailer's primary key
 * @param price       - The new scraped price
 * @param inStock     - Whether the product is currently in stock
 * @returns true if a new history row was inserted, false if price was unchanged
 */
async function recordPriceChange(
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

export { getPriceHistory, recordPriceChange };
