/**
 * Market Trends route — returns components whose price has fluctuated recently.
 *
 * GET /api/market-trends?days=7&limit=20&category=gpu&type=drops
 *
 * types: 'drops' (price decreased), 'hikes' (price increased)
 */

import { Hono } from 'hono';
import { getSql } from '../db/index.js';

const marketTrendsRouter = new Hono();

marketTrendsRouter.get('/', async (c) => {
  const sql      = getSql();

  // Parse and validate numeric params — fall back to defaults on invalid input
  // to avoid passing NaN to SQL queries.
  const daysRaw  = Number(c.req.query('days')  ?? 7);
  const limitRaw = Number(c.req.query('limit') ?? 20);
  const days     = Math.min(30, Math.max(1, Number.isFinite(daysRaw)  ? daysRaw  : 7));
  const limit    = Math.min(50, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 20));

  const category = c.req.query('category') || null;
  const type     = c.req.query('type') === 'hikes' ? 'hikes' : 'drops';

  const rows = await sql`
    WITH daily_market_min AS (
      -- Find the absolute cheapest in-stock price for each component per day
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
      -- Get the first and last recorded global minimums in the window
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
      -- Filter based on the requested trend type
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
      c.image_url
    FROM filtered_trends ft
    JOIN components c ON c.id = ft.component_id
    WHERE c.is_active = true
      AND (${category}::text IS NULL OR c.category = ${category})
      -- Must be in stock right now to be useful
      AND EXISTS (
        SELECT 1 FROM prices p 
        WHERE p.component_id = ft.component_id 
          AND p.in_stock = true
      )
    ORDER BY 
      CASE WHEN ${type} = 'drops' THEN ft.raw_diff END ASC,
      CASE WHEN ${type} = 'hikes' THEN ft.raw_diff END DESC
    LIMIT ${limit}
  ` as {
    component_id: number;
    price_before: number;
    price_after: number;
    raw_diff: number;
    change_pct: number;
    name: string;
    brand: string | null;
    slug: string;
    category: string;
    image_url: string | null;
  }[];

  return c.json({
    trends: rows.map(r => ({
      component_id: r.component_id,
      name:         r.name,
      brand:        r.brand,
      slug:         r.slug,
      category:     r.category,
      image_url:    r.image_url,
      price_before: Number(r.price_before),
      price_after:  Number(r.price_after),
      diff_amount:  Math.abs(Number(r.raw_diff)),
      change_pct:   Number(r.change_pct),
      type,
    })),
    days,
    type,
    total: rows.length,
  });
});

export { marketTrendsRouter };
