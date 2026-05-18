/**
 * Admin Controller — Handles dashboard and log requests.
 */

import type { Context } from 'hono';
import { AdminService } from '../services/adminService.js';
import { LogRepository } from '../repositories/logRepository.js';

export class AdminController {
  private adminService: AdminService;
  private logRepo: LogRepository;

  constructor() {
    this.adminService = new AdminService();
    this.logRepo = new LogRepository();
  }

  async getDashboardData(c: Context) {
    const data = await this.adminService.getDashboardData();
    return c.json(data);
  }

  async getLogs(c: Context) {
    const levelParam = c.req.query('level');
    const siteParam = c.req.query('site');
    const limitParam = c.req.query('limit');

    const VALID_LEVELS = ['INFO', 'WARNING', 'ERROR'];
    if (levelParam && !VALID_LEVELS.includes(levelParam)) {
      return c.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: `'level' must be one of: ${VALID_LEVELS.join(', ')}`,
            fields: ['level'],
          },
        },
        400,
      );
    }

    let limit = 100;
    if (limitParam) {
      const parsed = Number(limitParam);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        return c.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: "'limit' must be a positive integer",
              fields: ['limit'],
            },
          },
          400,
        );
      }
      limit = Math.min(parsed, 10000);
    }

    const logs = await this.logRepo.getLogs({
      level: levelParam as any,
      site: siteParam,
      limit,
    });

    return c.json({ logs, count: logs.length });
  }

  async deleteLogs(c: Context) {
    const keepDays = c.req.query('keep_days');
    const all = c.req.query('all');

    if (all === 'true') {
      const count = await this.logRepo.deleteAllLogs();
      return c.json({ deleted: count });
    }

    if (keepDays !== undefined) {
      const days = Number(keepDays);
      if (!Number.isInteger(days) || days < 0) {
        return c.json(
          { error: { code: 'VALIDATION_ERROR', message: "'keep_days' must be a non-negative integer" } },
          400,
        );
      }
      const count = await this.logRepo.deleteOldLogs(days);
      return c.json({ deleted: count });
    }

    return c.json(
      { error: { code: 'VALIDATION_ERROR', message: "Provide ?keep_days=N or ?all=true" } },
      400,
    );
  }
}
