/**
 * Admin Service — Dashboard stats and activity logging.
 *
 * Requirements: 7.1, 7.2, 7.3, 7.5
 */

import { sql as bunSql } from 'bun';

// ── Dependency injection ─────────────────────────────────────────────────────

type SqlFn = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown[]>;

let _sql: SqlFn = bunSql as unknown as SqlFn;

export function setSql(mockSql: SqlFn): void {
  _sql = mockSql;
}

export function resetSql(): void {
  _sql = bunSql as unknown as SqlFn;
}

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
}

// ── Service Functions ────────────────────────────────────────────────────────

/**
 * Returns all dashboard statistics in a single aggregated query set.
 */
async function getDashboardStats(): Promise<DashboardStats> {
  const [componentStats, retailerStats, priceStats, unmatchedStats, scrapeStats] =
    await Promise.all([
      // Components by category
      _sql`
        SELECT category, COUNT(id) AS count
        FROM components WHERE is_active = true
        GROUP BY category
      ` as Promise<{ category: string; count: string }[]>,

      // Retailer counts
      _sql`
        SELECT
          COUNT(id) AS total,
          COUNT(id) FILTER (WHERE is_active = true) AS active
        FROM retailers
      ` as Promise<{ total: string; active: string }[]>,

      // Total price records
      _sql`SELECT COUNT(id) AS total FROM prices` as Promise<{ total: string }[]>,

      // Unmatched listings pending review
      _sql`
        SELECT COUNT(id) AS total FROM unmatched_listings WHERE status = 'pending'
      ` as Promise<{ total: string }[]>,

      // Last scrape info
      _sql`
        SELECT last_scrape_at, last_scrape_status
        FROM retailers
        WHERE last_scrape_at IS NOT NULL
        ORDER BY last_scrape_at DESC
        LIMIT 1
      ` as Promise<{ last_scrape_at: string; last_scrape_status: string }[]>,
    ]);

  const components_by_category: Record<string, number> = {};
  let total_components = 0;
  for (const row of componentStats) {
    components_by_category[row.category] = parseInt(row.count, 10);
    total_components += parseInt(row.count, 10);
  }

  return {
    total_components,
    components_by_category,
    total_retailers: parseInt(retailerStats[0]?.total ?? '0', 10),
    active_retailers: parseInt(retailerStats[0]?.active ?? '0', 10),
    total_price_records: parseInt(priceStats[0]?.total ?? '0', 10),
    unmatched_listings_count: parseInt(unmatchedStats[0]?.total ?? '0', 10),
    last_scrape: {
      time: scrapeStats[0]?.last_scrape_at ?? null,
      status: scrapeStats[0]?.last_scrape_status ?? null,
    },
  };
}

/**
 * Returns the number of price records updated per day for the past N days.
 * Used for the dashboard bar chart.
 */
async function getPriceUpdatesChart(days: number = 30): Promise<PriceUpdateChartEntry[]> {
  const rows = (await _sql`
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
  return _sql`
    SELECT
      al.id,
      al.admin_id,
      al.action,
      al.entity_type,
      al.entity_id,
      al.details,
      al.created_at,
      a.email AS admin_email
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
  await _sql`
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

export { getDashboardStats, getPriceUpdatesChart, getRecentActivity, logActivity };
