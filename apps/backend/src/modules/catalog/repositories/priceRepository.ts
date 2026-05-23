/**
 * Price Repository
 * Handles all database operations related to component prices.
 */

import { getSql } from '../../../core/db/index.js';
import type { PriceOffer } from '@shared/types';

export interface LowestPriceRow {
  component_id: number;
  lowest_in_stock_price: number | null;
  lowest_any_price: number | null;
  any_in_stock: boolean;
}

export class PriceRepository {
  /**
   * Fetch price offers for a specific component.
   */
  async getPricesByComponentId(id: number): Promise<PriceOffer[]> {
    const sql = getSql();
    const rows = (await sql`
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
      WHERE p.component_id IN (
        SELECT c2.id FROM components c2
        WHERE COALESCE(c2.mpn, c2.name || '::' || c2.category) = (
          SELECT COALESCE(c1.mpn, c1.name || '::' || c1.category)
          FROM components c1 WHERE c1.id = ${id}
        )
      )
      ORDER BY p.in_stock DESC, p.price ASC
    `) as any[];
    return rows.map((row: any) => ({
      ...row,
      price: row.price ? Number(row.price) : 0
    })) as PriceOffer[];
  }

  /**
   * Fetch the lowest prices for a list of components.
   */
  async getLowestPrices(componentIds: number[]): Promise<LowestPriceRow[]> {
    if (componentIds.length === 0) return [];
    const sql = getSql();
    const rows = (await sql`
      SELECT
        component_id,
        MIN(CASE WHEN in_stock = true THEN price END) AS lowest_in_stock_price,
        MIN(price) AS lowest_any_price,
        BOOL_OR(in_stock) AS any_in_stock
      FROM prices
      WHERE component_id IN ${sql(componentIds)}
      GROUP BY component_id
    `) as any[];
    return rows.map((row: any) => ({
      ...row,
      lowest_in_stock_price: row.lowest_in_stock_price ? Number(row.lowest_in_stock_price) : null,
      lowest_any_price: row.lowest_any_price ? Number(row.lowest_any_price) : null
    })) as LowestPriceRow[];
  }
}
