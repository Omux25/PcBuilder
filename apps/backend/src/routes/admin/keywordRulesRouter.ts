/**
 * Admin keyword rules routes — JWT-protected
 *
 * GET  /api/admin/keyword-rules          — list all rules (admin + builtin) with match_count
 * POST /api/admin/keyword-rules          — create a new admin rule
 * DELETE /api/admin/keyword-rules/:id   — delete an admin rule (403 for builtin)
 * POST /api/admin/keyword-rules/preview — preview match count for keyword+match_type
 *
 * Requirements: 8.1–8.11, 9.1–9.4, 17.1, 18.1, 18.2
 */

import { Hono } from 'hono';
import { getSql } from '../../db/index.js';
import { authMiddleware } from '../../middleware/auth.js';
import { matchesRule, type KeywordRule } from '../../services/keywordRulesService.js';
import { runSuggestionPreprocessing } from '../../services/suggestionPreprocessor.js';
import { buildFromUnmatched } from '../../../scraper/catalogBuilder.js';
import { logActivity } from '../../services/adminService.js';
import type { AdminEnv } from './types.js';
import { parseId } from './types.js';

const keywordRulesRouter = new Hono<AdminEnv>();

keywordRulesRouter.use('/*', authMiddleware);

/**
 * Runs the full auto-processing pipeline after a keyword rule change:
 * 1. Re-compute suggestions (now with the new rule)
 * 2. Run catalogBuilder — auto-creates components for items that now have a category
 *
 * Fire-and-forget — errors are logged but not surfaced to the caller.
 */
async function runAutoProcessingPipeline(): Promise<void> {
    try {
        await runSuggestionPreprocessing(true); // force=true: new rule must apply to all existing listings
        await buildFromUnmatched();
    } catch (err) {
        console.error('[KEYWORD-RULES] Auto-processing pipeline failed:', err);
    }
}

const VALID_CATEGORIES = new Set([
    'cpu', 'gpu', 'ram', 'motherboard', 'storage',
    'psu', 'case', 'cooling', 'fan', 'thermal_paste',
]);

const VALID_MATCH_TYPES = new Set(['contains', 'word', 'starts_with', 'number_before']);

// ── GET / ─────────────────────────────────────────────────────────────────────
// Returns all rules (admin + builtin) with live match_count.
// match_count uses ILIKE '%keyword%' for performance (approximation).
// Requirements: 8.1, 9.1, 9.2, 9.3, 9.4

keywordRulesRouter.get('/', async (c) => {
    const sql = getSql();

    const rows = (await sql`
    SELECT
      kr.id,
      kr.keyword,
      kr.match_type,
      kr.category,
      kr.source,
      kr.created_by,
      kr.created_at,
      (
        SELECT COUNT(*)::int
        FROM unmatched_listings ul
        WHERE ul.status = 'pending'
          AND ul.scraped_name ILIKE '%' || kr.keyword || '%'
      ) AS match_count
    FROM keyword_rules kr
    ORDER BY kr.source ASC, kr.created_at DESC
  `) as (KeywordRule & { match_count: number })[];

    return c.json(rows);
});

// ── POST /preview ─────────────────────────────────────────────────────────────
// Must be registered BEFORE /:id to avoid route conflict.
// Returns exact match_count using full matchesRule logic.
// Requirements: 8.9

keywordRulesRouter.post('/preview', async (c) => {
    const sql = getSql();

    let body: Record<string, unknown>;
    try {
        body = await c.req.json();
    } catch {
        return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' } }, 400);
    }

    const keyword = typeof body.keyword === 'string' ? body.keyword.trim() : '';
    const match_type = body.match_type as string;

    if (!keyword || keyword.length > 200) {
        return c.json({ error: { code: 'INVALID_KEYWORD', message: 'keyword must be 1–200 characters' } }, 400);
    }
    if (!VALID_MATCH_TYPES.has(match_type)) {
        return c.json({
            error: {
                code: 'INVALID_MATCH_TYPE',
                message: `match_type must be one of: ${[...VALID_MATCH_TYPES].join(', ')}`,
            },
        }, 400);
    }

    // Fetch all pending listings and apply matchesRule for exact count
    const pending = (await sql`
    SELECT id, scraped_name FROM unmatched_listings WHERE status = 'pending'
  `) as { id: number; scraped_name: string }[];

    const rule = { keyword, match_type: match_type as KeywordRule['match_type'] };
    const matching = pending.filter(l => matchesRule(rule, l.scraped_name));

    return c.json({
        match_count: matching.length,
        sample_names: matching.slice(0, 20).map(l => l.scraped_name),
    });
});

// ── POST / ────────────────────────────────────────────────────────────────────
// Creates a new admin rule.
// Requirements: 8.2, 8.3, 8.4, 8.5, 8.6, 18.2

keywordRulesRouter.post('/', async (c) => {
    const sql = getSql();
    const admin = c.get('admin') as { id: number } | undefined;

    let body: Record<string, unknown>;
    try {
        body = await c.req.json();
    } catch {
        return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' } }, 400);
    }

    const keyword = typeof body.keyword === 'string' ? body.keyword.trim() : '';
    const match_type = body.match_type as string;
    const category = body.category as string;

    // Validate keyword
    if (!keyword || keyword.length > 200) {
        return c.json({ error: { code: 'INVALID_KEYWORD', message: 'keyword must be 1–200 characters' } }, 400);
    }

    // Validate match_type
    if (!VALID_MATCH_TYPES.has(match_type)) {
        return c.json({
            error: {
                code: 'INVALID_MATCH_TYPE',
                message: `match_type must be one of: ${[...VALID_MATCH_TYPES].join(', ')}`,
            },
        }, 400);
    }

    // Validate category
    if (!VALID_CATEGORIES.has(category)) {
        return c.json({
            error: {
                code: 'INVALID_CATEGORY',
                message: `category must be one of: ${[...VALID_CATEGORIES].join(', ')}`,
            },
        }, 400);
    }

    try {
        const rows = (await sql`
      INSERT INTO keyword_rules (keyword, match_type, category, source, created_by)
      VALUES (${keyword}, ${match_type}, ${category}, 'admin', ${admin?.id ?? null})
      RETURNING id, keyword, match_type, category, source, created_by, created_at
    `) as KeywordRule[];

        if (admin?.id) {
            await logActivity(admin.id, 'keyword_rule_created', 'keyword_rules', rows[0].id, {
                keyword,
                match_type,
                category,
            });
        }

        // Fire-and-forget: re-process suggestions + auto-build components with new rule
        runAutoProcessingPipeline();

        return c.json(rows[0], 201);
    } catch (err: unknown) {
        // Unique constraint violation → duplicate rule
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('unique') || msg.includes('duplicate') || msg.includes('23505')) {
            return c.json({
                error: {
                    code: 'DUPLICATE_RULE',
                    message: `A rule for keyword "${keyword}" + match_type "${match_type}" + category "${category}" already exists`,
                },
            }, 409);
        }
        throw err;
    }
});

// ── DELETE /:id ───────────────────────────────────────────────────────────────
// Deletes an admin rule. Returns 403 for builtin rules.
// Requirements: 8.7, 8.8, 18.1

keywordRulesRouter.delete('/:id', async (c) => {
    const sql = getSql();
    const admin = c.get('admin') as { id: number } | undefined;

    const id = parseId(c.req.param('id'));
    if (id === null) {
        return c.json({ error: { code: 'VALIDATION_ERROR', message: 'id must be a positive integer' } }, 400);
    }

    const rows = (await sql`
    SELECT id, keyword, match_type, category, source FROM keyword_rules WHERE id = ${id} LIMIT 1
  `) as { id: number; keyword: string; match_type: string; category: string; source: string }[];

    if (rows.length === 0) {
        return c.json({ error: { code: 'NOT_FOUND', message: `Keyword rule ${id} not found` } }, 404);
    }

    if (rows[0].source === 'builtin') {
        return c.json({
            error: {
                code: 'CANNOT_DELETE_BUILTIN',
                message: 'Built-in rules cannot be deleted',
            },
        }, 403);
    }

    await sql`DELETE FROM keyword_rules WHERE id = ${id}`;

    if (admin?.id) {
        await logActivity(admin.id, 'keyword_rule_deleted', 'keyword_rules', id, {
            keyword: rows[0].keyword,
            match_type: rows[0].match_type,
            category: rows[0].category,
        });
    }

    // Fire-and-forget: re-process suggestions without deleted rule
    runAutoProcessingPipeline();

    return c.json({ success: true });
});

export { keywordRulesRouter };
