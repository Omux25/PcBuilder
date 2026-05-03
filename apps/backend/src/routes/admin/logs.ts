/**
 * Admin logs route — JWT-protected
 *
 * GET    /api/admin/logs         — query scraper logs with optional filters
 * DELETE /api/admin/logs         — clear logs (?keep_days=7 or ?all=true)
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
const MAX_LIMIT = 10000;

// GET /api/admin/logs
adminLogsRouter.get('/', async (c) => {
  const sql = getSql();
  const levelParam = c.req.query('level');
  const siteParam = c.req.query('site');
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
  const site = siteParam;

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

// DELETE /api/admin/logs?keep_days=7   — delete logs older than N days
// DELETE /api/admin/logs?all=true      — delete all logs
adminLogsRouter.delete('/', async (c) => {
  const sql = getSql();
  const keepDays = c.req.query('keep_days');
  const all = c.req.query('all');

  if (all === 'true') {
    const result = await sql`DELETE FROM scraper_logs RETURNING id` as { id: number }[];
    return c.json({ deleted: result.length });
  }

  if (keepDays !== undefined) {
    const days = Number(keepDays);
    if (!Number.isInteger(days) || days < 0) {
      return c.json(
        { error: { code: 'VALIDATION_ERROR', message: "'keep_days' must be a non-negative integer" } },
        400,
      );
    }
    const result = await sql`
      DELETE FROM scraper_logs
      WHERE created_at < NOW() - (${days} || ' days')::INTERVAL
      RETURNING id
    ` as { id: number }[];
    return c.json({ deleted: result.length });
  }

  return c.json(
    { error: { code: 'VALIDATION_ERROR', message: "Provide ?keep_days=N or ?all=true" } },
    400,
  );
});

export { adminLogsRouter };
