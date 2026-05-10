/**
 * Admin unmatched accordion routes — JWT-protected
 *
 * GET  /api/admin/unmatched-listings/by-category  — lightweight category summary
 * POST /api/admin/unmatched-listings/reject        — reject one or more listings
 * POST /api/admin/unmatched-listings/bulk-associate — best-effort bulk link to existing components
 *
 * These routes power the new category-accordion UI in the admin panel.
 * They are purely additive — existing routes in unmatchedSuggestionsRouter are untouched.
 *
 * Requirements: 9.1, 9.3, 9.4, 9.5, 9.6, 9.7, 5.4, 5.5
 */

import { Hono } from 'hono';
import { getSql } from '../../db/index.js';
import { authMiddleware } from '../../middleware/auth.js';
import { logActivity } from '../../services/adminService.js';
import type { AdminEnv } from './types.js';

const unmatchedAccordionRouter = new Hono<AdminEnv>();

unmatchedAccordionRouter.use('/*', authMiddleware);

// ── GET /by-category ──────────────────────────────────────────────────────────
// Returns a lightweight summary of pending unmatched listings grouped by category.
// Used for the initial accordion render — no listing details, just counts.
//
// high_confidence_linkable_count = groups where confidence='high' AND existing_component_id IS NOT NULL
// category=null means the Unknown section (no suggestion row).
//
// Requirements: 9.1
unmatchedAccordionRouter.get('/by-category', async (c) => {
    const sql = getSql();

    const rows = (await sql`
        SELECT
            us.category,
            COUNT(DISTINCT COALESCE(us.canonical_name, ul.scraped_name))::int AS group_count,
            COUNT(DISTINCT CASE
                WHEN us.confidence = 'high' AND us.existing_component_id IS NOT NULL
                THEN COALESCE(us.canonical_name, ul.scraped_name)
            END)::int AS high_confidence_linkable_count
        FROM unmatched_listings ul
        LEFT JOIN unmatched_suggestions us ON us.unmatched_listing_id = ul.id
        WHERE ul.status = 'pending'
        GROUP BY us.category
        ORDER BY us.category ASC NULLS LAST
    `) as {
        category: string | null;
        group_count: number;
        high_confidence_linkable_count: number;
    }[];

    return c.json({ categories: rows });
});

// ── POST /reject ──────────────────────────────────────────────────────────────
// Rejects one or more listings by ID.
// - Sets status = 'dismissed' for all provided IDs that are currently 'pending'
// - Deletes their unmatched_suggestions rows
// - Skips non-pending IDs silently (they may have been linked by another admin)
// - Does NOT set manual_category — the listing is simply dismissed
//
// Handles both surgical (single ID) and bulk (all group IDs) rejections.
//
// Requirements: 9.3, 9.5
unmatchedAccordionRouter.post('/reject', async (c) => {
    const sql = getSql();
    const admin = c.get('admin') as { id: number } | undefined;

    let body: Record<string, unknown>;
    try {
        body = await c.req.json();
    } catch {
        return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' } }, 400);
    }

    const ids = body.listing_ids;
    if (!Array.isArray(ids) || ids.length === 0) {
        return c.json({
            error: { code: 'VALIDATION_ERROR', message: 'listing_ids must be a non-empty array' },
        }, 400);
    }

    // Filter to valid positive integers only — safe for sql.unsafe() interpolation
    const validIds = (ids as unknown[]).filter(
        (id): id is number => Number.isInteger(id) && (id as number) > 0,
    );
    if (validIds.length === 0) {
        return c.json({
            error: { code: 'VALIDATION_ERROR', message: 'No valid listing IDs provided' },
        }, 400);
    }

    // Update only pending listings — skip others silently
    // IDs are validated as positive integers above — sql.unsafe() is safe here
    const idList = validIds.join(',');
    const updated = (await sql.unsafe(`
        UPDATE unmatched_listings
        SET status = 'dismissed'
        WHERE id IN (${idList}) AND status = 'pending'
        RETURNING id
    `)) as { id: number }[];

    const rejected = updated.length;

    // Delete suggestion rows for the dismissed listings
    if (rejected > 0) {
        const dismissedIds = updated.map((r) => r.id).join(',');
        await sql.unsafe(`
            DELETE FROM unmatched_suggestions
            WHERE unmatched_listing_id IN (${dismissedIds})
        `);
    }

    if (admin?.id && rejected > 0) {
        await logActivity(admin.id, 'reject_listings', 'unmatched_listings', undefined, {
            rejected,
            listing_ids: validIds,
        });
    }

    return c.json({ rejected });
});

// ── POST /bulk-associate ──────────────────────────────────────────────────────
// Best-effort bulk association of high-confidence groups to existing components.
// - Accepts an array of canonical_names
// - For each name: finds high-confidence listings with existing_component_id
// - Links them in an independent per-name transaction
// - A failure on one name does NOT abort others
// - NEVER creates new components — only links to existing ones
//
// Returns { successful: [...], failed: [...] } for the summary toast.
//
// Requirements: 9.4, 9.6, 9.7, 5.4, 5.5
unmatchedAccordionRouter.post('/bulk-associate', async (c) => {
    const sql = getSql();
    const admin = c.get('admin') as { id: number } | undefined;

    let body: Record<string, unknown>;
    try {
        body = await c.req.json();
    } catch {
        return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' } }, 400);
    }

    const canonicalNames = body.canonical_names;
    if (!Array.isArray(canonicalNames) || canonicalNames.length === 0) {
        return c.json({
            error: { code: 'VALIDATION_ERROR', message: 'canonical_names must be a non-empty array' },
        }, 400);
    }

    // Filter to non-empty strings only
    const validNames = (canonicalNames as unknown[]).filter(
        (n): n is string => typeof n === 'string' && n.trim().length > 0,
    );
    if (validNames.length === 0) {
        return c.json({
            error: { code: 'VALIDATION_ERROR', message: 'No valid canonical names provided' },
        }, 400);
    }

    const successful: Array<{ canonical_name: string; linked_count: number; component_id: number }> = [];
    const failed: Array<{ canonical_name: string; error: string }> = [];

    // Process each canonical name independently — failure on one does not affect others
    for (const name of validNames) {
        try {
            // Fetch all high-confidence pending listings for this canonical name
            const listings = (await sql`
                SELECT
                    us.existing_component_id,
                    ul.id          AS listing_id,
                    ul.retailer_id,
                    ul.product_url,
                    ul.scraped_name
                FROM unmatched_suggestions us
                JOIN unmatched_listings ul ON ul.id = us.unmatched_listing_id
                WHERE us.canonical_name = ${name}
                  AND us.confidence = 'high'
                  AND us.existing_component_id IS NOT NULL
                  AND ul.status = 'pending'
            `) as {
                existing_component_id: number;
                listing_id: number;
                retailer_id: number;
                product_url: string;
                scraped_name: string;
            }[];

            if (listings.length === 0) {
                failed.push({ canonical_name: name, error: 'No high-confidence match found' });
                continue;
            }

            // All listings in a group share the same existing_component_id
            const componentId = listings[0].existing_component_id;

            // Run all links for this canonical name in a single transaction
            await sql.begin(async (tx) => {
                for (const listing of listings) {
                    await tx`
                        INSERT INTO scraper_mappings (component_id, retailer_id, product_url, product_identifier)
                        VALUES (${componentId}, ${listing.retailer_id}, ${listing.product_url}, ${listing.scraped_name})
                        ON CONFLICT (retailer_id, product_url) DO UPDATE SET
                            component_id = EXCLUDED.component_id,
                            updated_at   = NOW()
                    `;
                    await tx`
                        UPDATE unmatched_listings
                        SET status = 'linked', linked_component_id = ${componentId}
                        WHERE id = ${listing.listing_id}
                    `;
                    await tx`
                        DELETE FROM unmatched_suggestions
                        WHERE unmatched_listing_id = ${listing.listing_id}
                    `;
                }
            });

            successful.push({
                canonical_name: name,
                linked_count: listings.length,
                component_id: componentId,
            });
        } catch (err) {
            failed.push({
                canonical_name: name,
                error: err instanceof Error ? err.message : String(err),
            });
        }
    }

    if (admin?.id && successful.length > 0) {
        await logActivity(admin.id, 'bulk_associate', 'unmatched_listings', undefined, {
            successful_count: successful.length,
            failed_count: failed.length,
            linked_total: successful.reduce((sum, s) => sum + s.linked_count, 0),
        });
    }

    return c.json({ successful, failed });
});

export { unmatchedAccordionRouter };
