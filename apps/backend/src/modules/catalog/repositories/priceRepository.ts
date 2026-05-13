/**
 * Price Repository
 * Handles all database operations related to component prices.
 */

import { getSql } from '../../../core/db/index.js';
import { PriceOffer } from '@shared/types';

export interface LowestPriceRow {
  component_id: number;
  lowest_in_stock_price: string | null;
  lowest_any_price: string | null;
  any_in_stock: boolean;
}

export class PriceRepository {
  /**
   * Fetch price offers for a specific component.
   */
  async getPricesByComponentId(id: number): Promise<PriceOffer[]> {
    const sql = getSql();
    return sql`
      SELECT
        r.id              AS retailer_id,
        r.name            AS retailer_name,
        p.price,
        p.in_stock,
        p.product_url,
        p.variant_label,
        p.variant_details,
        p.last_updated
      FROM prices p
      JOIN retailers r ON r.id = p.retailer_id
      WHERE p.component_id = ${id}
      ORDER BY p.in_stock DESC, p.price ASC
    ` as Promise<PriceOffer[]>;
  }

  /**
   * Fetch the lowest prices for a list of components.
   */
  async getLowestPrices(componentIds: number[]): Promise<LowestPriceRow[]> {
    if (componentIds.length === 0) return [];
    const sql = getSql();
    return sql`
      SELECT
        component_id,
        MIN(CASE WHEN in_stock = true THEN price END) AS lowest_in_stock_price,
        MIN(price) AS lowest_any_price,
        BOOL_OR(in_stock) AS any_in_stock
      FROM prices
      WHERE component_id IN ${sql(componentIds)}
      GROUP BY component_id
    ` as Promise<LowestPriceRow[]>;
  }
}
