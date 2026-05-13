/**
 * Log Repository — Database access for scraper logs.
 */

import { getSql } from '../../../core/db/index.js';

export interface ScraperLog {
  id: number;
  level: 'INFO' | 'WARNING' | 'ERROR';
  site: string | null;
  message: string;
  created_at: string;
}

export class LogRepository {
  async getLogs(params: {
    level?: 'INFO' | 'WARNING' | 'ERROR';
    site?: string;
    limit: number;
  }): Promise<ScraperLog[]> {
    return getSql()`
      SELECT id, level, site, message, created_at
      FROM scraper_logs
      WHERE (${params.level ?? null}::text IS NULL OR level = ${params.level ?? null})
        AND (${params.site ?? null}::text IS NULL OR site  = ${params.site ?? null})
      ORDER BY created_at DESC
      LIMIT ${params.limit}
    ` as Promise<ScraperLog[]>;
  }

  async deleteAllLogs(): Promise<number> {
    const result = await getSql()`DELETE FROM scraper_logs RETURNING id` as { id: number }[];
    return result.length;
  }

  async deleteOldLogs(days: number): Promise<number> {
    const result = await getSql()`
      DELETE FROM scraper_logs
      WHERE created_at < NOW() - (${days} || ' days')::INTERVAL
      RETURNING id
    ` as { id: number }[];
    return result.length;
  }
}
