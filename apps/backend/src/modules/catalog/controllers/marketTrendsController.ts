import type { Context } from 'hono';
import { getSql } from '../../../core/db/index.js';

export class MarketTrendsController {
  async getTrends(c: Context) {
    const sql = getSql();

    const daysRaw = Number(c.req.query('days') ?? 7);
    const limitRaw = Number(c.req.query('limit') ?? 20);
    const days = Math.min(30, Math.max(1, Number.isFinite(daysRaw) ? daysRaw : 7));
    const limit = Math.min(50, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 20));

    const category = c.req.query('category') || null;
    const type = c.req.query('type') === 'hikes' ? 'hikes' : 'drops';
    const inStockParam = c.req.query('in_stock') ?? 'true';

    const rows = await sql`
      WITH daily_market_min AS (
        SELECT
          ph.component_id,
          ph.recorded_at::date AS day,
          MIN(ph.price) AS min_price
        FROM price_history ph
        WHERE ph.in_stock = true
          AND ph.recorded_at >= NOW() - (${days} || ' days')::INTERVAL
        GROUP BY ph.component_id, ph.recorded_at::date
      ),
      price_trends AS (
        SELECT
          component_id,
          FIRST_VALUE(min_price) OVER (
            PARTITION BY component_id
            ORDER BY day ASC
            ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
          ) AS price_before,
          FIRST_VALUE(min_price) OVER (
            PARTITION BY component_id
            ORDER BY day DESC
            ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
          ) AS price_after,
          COUNT(*) OVER (PARTITION BY component_id) AS day_count
        FROM daily_market_min
      ),
      filtered_trends AS (
        SELECT DISTINCT ON (component_id)
          component_id,
          price_before::numeric,
          price_after::numeric,
          (price_after - price_before)::numeric AS raw_diff,
          ROUND(
            (ABS(price_after - price_before) / price_before * 100)::numeric,
            1
          ) AS change_pct
        FROM price_trends
        WHERE day_count > 1
          AND ABS(price_after - price_before) >= 20 -- Min 20 MAD change
          AND (ABS(price_after - price_before) / price_before * 100) >= 2 -- Min 2% change
          AND (
            (${type} = 'drops' AND price_after < price_before) OR
            (${type} = 'hikes' AND price_after > price_before)
          )
      )
      SELECT
        ft.*,
        c.name,
        c.brand,
        c.slug,
        c.category,
        c.image_url,
        COALESCE(ap.in_stock, false) AS in_stock
      FROM filtered_trends ft
      JOIN components c ON c.id = ft.component_id
      LEFT JOIN (
        SELECT component_id, bool_or(in_stock) as in_stock
        FROM prices
        GROUP BY component_id
      ) ap ON ap.component_id = ft.component_id
      WHERE c.is_active = true
        AND (${category}::text IS NULL OR c.category = ${category})
        AND (
          ${inStockParam} = 'all' OR
          (${inStockParam} = 'true' AND COALESCE(ap.in_stock, false) = true) OR
          (${inStockParam} = 'false' AND COALESCE(ap.in_stock, false) = false)
        )
      ORDER BY 
        CASE WHEN ${type} = 'drops' THEN ft.raw_diff END ASC,
        CASE WHEN ${type} = 'hikes' THEN ft.raw_diff END DESC
      LIMIT ${limit}
    ` as any[];

    return c.json({
      trends: rows.map(r => ({
        component_id: r.component_id,
        name: r.name,
        brand: r.brand,
        slug: r.slug,
        category: r.category,
        image_url: r.image_url,
        price_before: Number(r.price_before),
        price_after: Number(r.price_after),
        diff_amount: Math.abs(Number(r.raw_diff)),
        change_pct: Number(r.change_pct),
        type,
        in_stock: Boolean(r.in_stock),
      })),
      days,
      type,
      total: rows.length,
    });
  }
}
