import { getSql } from '../../core/db/index.js';

export interface TrafficLogEntry {
  ip?: string;
  method: string;
  path: string;
  userAgent?: string;
  statusCode: number;
  responseTimeMs: number;
}

const MAX_LOGS = 10000;

export const trafficService = {
  async logTraffic(entry: TrafficLogEntry) {
    const sql = getSql();
    try {
      await sql`
        INSERT INTO traffic_logs (
          ip, method, path, user_agent, status_code, response_time_ms
        ) VALUES (
          ${entry.ip ?? null}, 
          ${entry.method}, 
          ${entry.path}, 
          ${entry.userAgent ?? null}, 
          ${entry.statusCode}, 
          ${entry.responseTimeMs}
        )
      `;
    } catch (err) {
      console.error('[TrafficService] Failed to insert traffic log', err);
    }
  },

  async trimTrafficLogs() {
    const sql = getSql();
    try {
      // Keeps the newest 10,000 logs and deletes the rest
      await sql`
        DELETE FROM traffic_logs
        WHERE id IN (
          SELECT id FROM traffic_logs
          ORDER BY created_at DESC
          OFFSET ${MAX_LOGS}
        )
      `;
    } catch (err) {
      console.error('[TrafficService] Failed to trim traffic logs', err);
    }
  },

  async getTrafficLogs(limit = 50, offset = 0) {
    const sql = getSql();
    const rows = await sql`
      SELECT id, ip, method, path, user_agent as "userAgent", 
             status_code as "statusCode", response_time_ms as "responseTimeMs", created_at as "createdAt"
      FROM traffic_logs
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const countResult = await sql`SELECT COUNT(*) as total FROM traffic_logs`;
    const total = Number(countResult[0]?.total || 0);

    return {
      data: rows,
      total,
    };
  },

  async clearAllLogs() {
    const sql = getSql();
    await sql`TRUNCATE TABLE traffic_logs`;
  }
};
