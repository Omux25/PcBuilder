/**
 * Admin Repository — Database access for admin-related queries.
 */

import { getSql } from '../../../core/db/index.js';

export interface DashboardStatsRaw {
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

export class AdminRepository {
  async getDashboardStats(): Promise<DashboardStatsRaw> {
    const [componentStats, retailerStats, priceStats, unmatchedStats, scrapeStats] =
      await Promise.allSettled([
        getSql()`
          SELECT category, COUNT(id) AS count
          FROM components WHERE is_active = true
          GROUP BY category
        ` as Promise<{ category: string; count: string }[]>,

        getSql()`
          SELECT
            COUNT(id) FILTER (WHERE is_active = true) AS total,
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
    const priceRow = priceStats.status === 'fulfilled' ? priceStats.value[0] : null;
    const unmatchedRow = unmatchedStats.status === 'fulfilled' ? unmatchedStats.value[0] : null;
    const scrapeRow = scrapeStats.status === 'fulfilled' ? scrapeStats.value[0] : null;

    return {
      total_components,
      components_by_category,
      total_retailers: retailerRow ? parseInt(retailerRow.total, 10) : 0,
      active_retailers: retailerRow ? parseInt(retailerRow.active, 10) : 0,
      total_price_records: priceRow ? parseInt(priceRow.total, 10) : 0,
      unmatched_listings_count: unmatchedRow ? parseInt(unmatchedRow.total, 10) : 0,
      last_scrape: {
        time: scrapeRow?.last_scrape_at ?? null,
        status: scrapeRow?.last_scrape_status ?? null,
      },
    };
  }

  async getPriceUpdatesChart(days: number): Promise<PriceUpdateChartEntry[]> {
    const rows = (await getSql()`
      SELECT
        DATE(recorded_at) AS date,
        COUNT(id) AS count
      FROM price_history
      WHERE recorded_at >= NOW() - (${days} || ' days')::INTERVAL
      GROUP BY DATE(recorded_at)
      ORDER BY date ASC
    `) as { date: string; count: string }[];

    const dbMap = new Map<string, number>();
    for (const r of rows) {
      // Postgres returns dates as e.g. "2023-10-27T00:00:00.000Z" when using postgresjs or strings, we only want YYYY-MM-DD
      const d = new Date(r.date);
      const key = d.toISOString().split('T')[0];
      dbMap.set(key, parseInt(r.count, 10));
    }

    const result: PriceUpdateChartEntry[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      result.push({
        date: key,
        count: dbMap.get(key) || 0,
      });
    }

    return result;
  }

  async getRecentActivity(limit: number): Promise<ActivityEntry[]> {
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
      WHERE al.action NOT IN ('bulk_category_update', 'system_tick', 'health_check')
      ORDER BY al.created_at DESC
      LIMIT ${limit}
    ` as Promise<ActivityEntry[]>;
  }

  async logActivity(
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
}
