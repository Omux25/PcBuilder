/**
 * Admin logs route — JWT-protected
 *
 * GET /api/admin/logs — query scraper logs with optional filters
 *
 * Query params:
 *   ?level=INFO|WARNING|ERROR  — filter by log level
 *   ?site=<string>             — filter by site name
 *   ?limit=<number>            — max rows to return (default 100, max 500)
 *
 * Requirements: 9.1, 9.2, 9.3
 */

import { Hono } from 'hono';
import { authMiddleware } from '../../middleware/auth.js';
import { getSql } from '../../db/index.js';

// ── Types ────────────────────────────────────────────────────────────────────

interface ScraperLog {
  id: number;
  level: 'INFO' | 'WARNING' | 'ERROR';
  site: string | null;
  message: string;
  created_at: string;
}

// ── Router ───────────────────────────────────────────────────────────────────

const adminLogsRouter = new Hono();

// All routes in this file require a valid JWT
adminLogsRouter.use('/*', authMiddleware);

const VALID_LEVELS = ['INFO', 'WARNING', 'ERROR'] as const;
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

// GET /api/admin/logs
adminLogsRouter.get('/', async (c) => {
  const sql = getSql();
  const levelParam = c.req.query('level');
  const siteParam  = c.req.query('site');
  const limitParam = c.req.query('limit');

  // Validate level
  if (levelParam !== undefined && !VALID_LEVELS.includes(levelParam as typeof VALID_LEVELS[number])) {
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

  // Validate limit
  let limit = DEFAULT_LIMIT;
  if (limitParam !== undefined) {
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
    limit = Math.min(parsed, MAX_LIMIT);
  }

  const level = levelParam as typeof VALID_LEVELS[number] | undefined;
  const site  = siteParam;

  // Single query with nullable parameters — avoids 4-branch if/else.
  // Bun.sql treats null parameters as "skip this condition" when cast to the right type.
  const rows = await sql`
    SELECT id, level, site, message, created_at
    FROM scraper_logs
    WHERE (${level ?? null}::text IS NULL OR level = ${level ?? null})
      AND (${site ?? null}::text IS NULL OR site  = ${site ?? null})
    ORDER BY created_at DESC
    LIMIT ${limit}
  ` as ScraperLog[];

  return c.json({ logs: rows, count: rows.length });
});

export { adminLogsRouter };
