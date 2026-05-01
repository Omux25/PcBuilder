/**
 * Admin Service — Dashboard stats and activity logging.
 *
 * Requirements: 7.1, 7.2, 7.3, 7.5
 */

import { getSql } from '../db/index.js';
import { DashboardData } from '@shared/types';

// ── Types ────────────────────────────────────────────────────────────────────

export interface DashboardStats {
  total_components: number;
  components_by_category: Record<string, number>;
  total_retailers: number;
  active_retailers: number;
  total_price_records: number;
  unmatched_listings_count: number;
  last_scrape: {
    time: string | null;
    status: string | null;
  };
}

export interface PriceUpdateChartEntry {
  date: string;
  count: number;
}

export interface ActivityEntry {
  id: number;
  admin_id: number;
  action: string;
  entity_type?: string;
  entity_id?: number;
  details?: Record<string, unknown>;
  created_at: string;
  admin_username?: string;
}

// ── Service Functions ────────────────────────────────────────────────────────

/**
 * Returns all dashboard statistics in a single aggregated query set.
 * Aligns with the DashboardData interface from @shared/types.
 */
async function getDashboardData(): Promise<DashboardData> {
  const [stats, updates, activity] = await Promise.all([
    getDashboardStats(),
    getPriceUpdatesChart(14),
    getRecentActivity(10)
  ]);

  return {
    stats,
    price_updates_chart: updates,
    recent_activity: activity.map(a => ({
      id: a.id,
      action: a.action,
      entity_type: a.entity_type ?? null,
      entity_id: a.entity_id ?? null,
      created_at: a.created_at
    }))
  };
}

async function getDashboardStats(): Promise<DashboardStats> {
  const [componentStats, retailerStats, priceStats, unmatchedStats, scrapeStats] =
    await Promise.allSettled([
      getSql()`
        SELECT category, COUNT(id) AS count
        FROM components WHERE is_active = true
        GROUP BY category
      ` as Promise<{ category: string; count: string }[]>,

      getSql()`
        SELECT
          COUNT(id) AS total,
          COUNT(id) FILTER (WHERE is_active = true) AS active
        FROM retailers
      ` as Promise<{ total: string; active: string }[]>,

      getSql()`SELECT COUNT(id) AS total FROM prices` as Promise<{ total: string }[]>,

      getSql()`
        SELECT COUNT(id) AS total FROM unmatched_listings WHERE status = 'pending'
      ` as Promise<{ total: string }[]>,

      getSql()`
        SELECT last_scrape_at, last_scrape_status
        FROM retailers
        WHERE last_scrape_at IS NOT NULL
        ORDER BY last_scrape_at DESC
        LIMIT 1
      ` as Promise<{ last_scrape_at: string; last_scrape_status: string }[]>,
    ]);

  const components_by_category: Record<string, number> = {};
  let total_components = 0;
  if (componentStats.status === 'fulfilled') {
    for (const row of componentStats.value) {
      components_by_category[row.category] = parseInt(row.count, 10);
      total_components += parseInt(row.count, 10);
    }
  }

  const retailerRow = retailerStats.status === 'fulfilled' ? retailerStats.value[0] : null;
  const priceRow    = priceStats.status === 'fulfilled'    ? priceStats.value[0]    : null;
  const unmatchedRow = unmatchedStats.status === 'fulfilled' ? unmatchedStats.value[0] : null;
  const scrapeRow   = scrapeStats.status === 'fulfilled'   ? scrapeStats.value[0]   : null;

  return {
    total_components,
    components_by_category,
    total_retailers:          retailerRow ? parseInt(retailerRow.total, 10)  : 0,
    active_retailers:         retailerRow ? parseInt(retailerRow.active, 10) : 0,
    total_price_records:      priceRow    ? parseInt(priceRow.total, 10)     : 0,
    unmatched_listings_count: unmatchedRow ? parseInt(unmatchedRow.total, 10) : 0,
    last_scrape: {
      time:   scrapeRow?.last_scrape_at     ?? null,
      status: scrapeRow?.last_scrape_status ?? null,
    },
  };
}

/**
 * Returns the number of price records updated per day for the past N days.
 * Used for the dashboard bar chart.
 */
async function getPriceUpdatesChart(days: number = 30): Promise<PriceUpdateChartEntry[]> {
  // Note: (${days} || ' days')::INTERVAL is safe — ${days} is a Bun.sql parameter,
  // not string interpolation. The || concatenation happens inside PostgreSQL.
  const rows = (await getSql()`
    SELECT
      DATE(recorded_at) AS date,
      COUNT(id) AS count
    FROM price_history
    WHERE recorded_at >= NOW() - (${days} || ' days')::INTERVAL
    GROUP BY DATE(recorded_at)
    ORDER BY date ASC
  `) as { date: string; count: string }[];

  return rows.map((r) => ({ date: r.date, count: parseInt(r.count, 10) }));
}

/**
 * Returns the most recent admin activity entries.
 */
async function getRecentActivity(limit: number = 10): Promise<ActivityEntry[]> {
  return getSql()`
    SELECT
      al.id,
      al.admin_id,
      al.action,
      al.entity_type,
      al.entity_id,
      al.details,
      al.created_at,
      a.username AS admin_username
    FROM admin_activity_log al
    JOIN admins a ON a.id = al.admin_id
    ORDER BY al.created_at DESC
    LIMIT ${limit}
  ` as Promise<ActivityEntry[]>;
}

/**
 * Inserts an entry into the admin activity log.
 *
 * @param adminId    - The admin performing the action
 * @param action     - Action name (e.g. 'component_created')
 * @param entityType - Type of entity affected (e.g. 'component')
 * @param entityId   - ID of the affected entity
 * @param details    - Optional extra context as JSON
 */
async function logActivity(
  adminId: number,
  action: string,
  entityType?: string,
  entityId?: number,
  details?: Record<string, unknown>
): Promise<void> {
  await getSql()`
    INSERT INTO admin_activity_log (admin_id, action, entity_type, entity_id, details)
    VALUES (
      ${adminId},
      ${action},
      ${entityType ?? null},
      ${entityId ?? null},
      ${details ?? null}
    )
  `;
}

export { getDashboardData, getDashboardStats, getPriceUpdatesChart, getRecentActivity, logActivity };
