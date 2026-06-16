import { getSql } from '../../core/db/index.js';

export interface TrafficLogEntry {
  ip?: string;
  method: string;
  path: string;
  userAgent?: string;
  statusCode: number;
  responseTimeMs: number;
  createdAt?: Date;
}

const MAX_LOGS = 10000;
const MAX_QUEUE_SIZE = 100;
const FLUSH_INTERVAL_MS = 10000; // 10 seconds

const logQueue: TrafficLogEntry[] = [];
let flushTimeout: Timer | null = null;

async function flushLogs() {
  if (flushTimeout) {
    clearTimeout(flushTimeout);
    flushTimeout = null;
  }

  if (logQueue.length === 0) return;

  const batch = [...logQueue];
  logQueue.length = 0;

  const sql = getSql();
  try {
    const mappedRows = batch.map(entry => ({
      ip: entry.ip ?? null,
      method: entry.method,
      path: entry.path,
      user_agent: entry.userAgent ?? null,
      status_code: entry.statusCode,
      response_time_ms: entry.responseTimeMs,
      created_at: entry.createdAt
    }));

    await sql`
      INSERT INTO traffic_logs ${ sql(mappedRows) }
    `;
  } catch (err) {
    console.error('[TrafficService] Failed to flush traffic logs batch:', err);
  }
}

export const trafficService = {
  async logTraffic(entry: TrafficLogEntry) {
    if (!entry.createdAt) {
      entry.createdAt = new Date();
    }
    logQueue.push(entry);
    
    if (logQueue.length >= MAX_QUEUE_SIZE) {
      flushLogs().catch(err => {
        console.error('[TrafficService] Immediate flush failed:', err);
      });
    } else if (!flushTimeout) {
      flushTimeout = setTimeout(() => {
        flushLogs().catch(err => {
          console.error('[TrafficService] Scheduled flush failed:', err);
        });
      }, FLUSH_INTERVAL_MS) as any;
      if (flushTimeout && typeof flushTimeout.unref === 'function') {
        flushTimeout.unref();
      }
    }
  },

  async flushAllPending() {
    await flushLogs();
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

  async getTrafficLogs(limit = 50, offset = 0, ip?: string) {
    await flushLogs(); // Ensure real-time accuracy for the dashboard
    const sql = getSql();
    
    // We use a trick: if ip is provided, we filter where ip LIKE %ip%.
    // Because ip might be "127.0.0.1" or "127.0.0.1, 10.0.0.1"
    const rows = ip 
      ? await sql`
        SELECT id, ip, method, path, user_agent as "userAgent", 
               status_code as "statusCode", response_time_ms as "responseTimeMs", created_at as "createdAt"
        FROM traffic_logs
        WHERE ip LIKE ${'%' + ip + '%'}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `
      : await sql`
        SELECT id, ip, method, path, user_agent as "userAgent", 
               status_code as "statusCode", response_time_ms as "responseTimeMs", created_at as "createdAt"
        FROM traffic_logs
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;

    const countResult = ip 
      ? await sql`SELECT COUNT(*) as total FROM traffic_logs WHERE ip LIKE ${'%' + ip + '%'}`
      : await sql`SELECT COUNT(*) as total FROM traffic_logs`;
      
    const total = Number(countResult[0]?.total || 0);

    return {
      data: rows,
      total,
    };
  },

  async getTrafficVisitors(limit = 50, offset = 0) {
    await flushLogs(); // Ensure real-time accuracy for the dashboard
    const sql = getSql();
    const rows = await sql`
      SELECT 
        TRIM(SPLIT_PART(ip, ',', 1)) as ip,
        MAX(user_agent) as "userAgent",
        MIN(created_at) as "firstSeen",
        MAX(created_at) as "lastSeen",
        COUNT(id)::int as "totalRequests",
        COUNT(id) FILTER (WHERE status_code >= 400)::int as "errorCount"
      FROM traffic_logs
      GROUP BY TRIM(SPLIT_PART(ip, ',', 1))
      ORDER BY "lastSeen" DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const countResult = await sql`
      SELECT COUNT(DISTINCT TRIM(SPLIT_PART(ip, ',', 1))) as total 
      FROM traffic_logs
    `;
    const total = Number(countResult[0]?.total || 0);

    return {
      data: rows,
      total,
    };
  },

  async clearAllLogs() {
    logQueue.length = 0; // Clear the memory queue so old logs don't resurrect
    if (flushTimeout) {
      clearTimeout(flushTimeout);
      flushTimeout = null;
    }
    const sql = getSql();
    await sql`TRUNCATE TABLE traffic_logs`;
  }
};
