/**
 * Admin unmatched suggestions routes — JWT-protected
 *
 * GET  /api/admin/unmatched-listings/grouped          — listings grouped by canonical_name
 * POST /api/admin/unmatched-listings/reprocess        — trigger suggestion pre-processing
 * POST /api/admin/unmatched-listings/bulk-dismiss     — dismiss multiple listings
 * POST /api/admin/unmatched-listings/bulk-approve     — link all high-confidence groups
 * POST /api/admin/unmatched-listings/create-and-link  — create component + link listings
 *
 * All routes are additive — the existing adminUnmatchedRouter is untouched.
 * Requirements: 7, 8, 9, 10, 13, 14, 15
 */

import { Hono } from 'hono';
import { getSql } from '../../db/index.js';
import { authMiddleware } from '../../middleware/auth.js';
import { logActivity } from '../../services/adminService.js';
import { runSuggestionPreprocessing } from '../../services/suggestionPreprocessor.js';
import { componentSchemas } from '../../schemas/componentSchemas.js';
import { getUniqueSlug } from '../../services/slugService.js';
import type { AdminEnv } from './types.js';
import { parseId } from './types.js';

const unmatchedSuggestionsRouter = new Hono<AdminEnv>();

unmatchedSuggestionsRouter.use('/*', authMiddleware);

// ── GET /grouped ──────────────────────────────────────────────────────────────
// Returns pending listings grouped by canonical_name from unmatched_suggestions.
// Listings with no suggestion row fall back to raw scraped_name with confidence "unknown".
// Supports ?search= and ?retailer_id= filters.
// Requirements: 10.1, 10.4, 10.5, 10.6

unmatchedSuggestionsRouter.get('/grouped', async (c) => {
    const sql = getSql();
    const search = c.req.query('search')?.trim() ?? '';
    const retailerIdRaw = c.req.query('retailer_id');
    const retailerId = retailerIdRaw ? Number(retailerIdRaw) : null;
    const page = Math.max(1, Number(c.req.query('page') ?? 1) || 1);
    const limit = Math.min(100, Math.max(1, Number(c.req.query('limit') ?? 50) || 50));
    const offset = (page - 1) * limit;

    // Fetch all pending listings with their suggestion data (left join)
    const rows = (await sql`
    SELECT
      ul.id,
      ul.retailer_id,
      r.name                        AS retailer_name,
      ul.scraped_name,
      ul.scraped_price,
      ul.product_url,
      ul.scraped_at,
      COALESCE(us.canonical_name, ul.scraped_name) AS canonical_name,
      us.brand,
      us.category,
      COALESCE(us.confidence, 'unknown')           AS confidence,
      us.existing_component_id,
      us.specs_hint,
      -- existing component name for display
      ec.name                       AS existing_component_name,
      ec.brand                      AS existing_component_brand
    FROM unmatched_listings ul
    JOIN retailers r ON r.id = ul.retailer_id
    LEFT JOIN unmatched_suggestions us ON us.unmatched_listing_id = ul.id
    LEFT JOIN components ec ON ec.id = us.existing_component_id
    WHERE ul.status = 'pending'
      AND (${retailerId}::int IS NULL OR ul.retailer_id = ${retailerId})
      AND (
        ${search}::text = ''
        OR ul.scraped_name ILIKE '%' || ${search} || '%'
        OR COALESCE(us.canonical_name, ul.scraped_name) ILIKE '%' || ${search} || '%'
      )
    ORDER BY ul.scraped_at DESC
  `) as {
        id: number;
        retailer_id: number;
        retailer_name: string;
        scraped_name: string;
        scraped_price: string | null;
        product_url: string;
        scraped_at: string;
        canonical_name: string;
        brand: string | null;
        category: string | null;
        confidence: string;
        existing_component_id: number | null;
        specs_hint: Record<string, unknown> | null;
        existing_component_name: string | null;
        existing_component_brand: string | null;
    }[];

    // Group by canonical_name
    const groupMap = new Map<string, {
        canonical_name: string;
        brand: string | null;
        category: string | null;
        confidence: string;
        existing_component_id: number | null;
        existing_component_name: string | null;
        specs_hint: Record<string, unknown>;
        listings: typeof rows;
    }>();

    for (const row of rows) {
        const key = row.canonical_name;
        if (!groupMap.has(key)) {
            groupMap.set(key, {
                canonical_name: row.canonical_name,
                brand: row.brand,
                category: row.category,
                confidence: row.confidence,
                existing_component_id: row.existing_component_id,
                existing_component_name: row.existing_component_name
                    ? `${row.existing_component_brand ? row.existing_component_brand + ' ' : ''}${row.existing_component_name}`
                    : null,
                specs_hint: row.specs_hint ?? {},
                listings: [],
            });
        }
        groupMap.get(key)!.listings.push(row);
    }

    // Sort by group size descending, then paginate
    const allGroups = [...groupMap.values()].sort(
        (a, b) => b.listings.length - a.listings.length,
    );

    const total_groups = allGroups.length;
    const total_listings = rows.length;
    const paginatedGroups = allGroups.slice(offset, offset + limit);

    const groups = paginatedGroups.map((g) => ({
        canonical_name: g.canonical_name,
        brand: g.brand,
        category: g.category,
        confidence: g.confidence,
        existing_component_id: g.existing_component_id,
        existing_component_name: g.existing_component_name,
        specs_hint: g.specs_hint,
        retailer_count: new Set(g.listings.map((l) => l.retailer_id)).size,
        listing_count: g.listings.length,
        price_min: g.listings.reduce((min, l) => {
            const p = l.scraped_price ? Number(l.scraped_price) : null;
            return p !== null && (min === null || p < min) ? p : min;
        }, null as number | null),
        price_max: g.listings.reduce((max, l) => {
            const p = l.scraped_price ? Number(l.scraped_price) : null;
            return p !== null && (max === null || p > max) ? p : max;
        }, null as number | null),
        listings: g.listings.map((l) => ({
            id: l.id,
            retailer_id: l.retailer_id,
            retailer_name: l.retailer_name,
            scraped_name: l.scraped_name,
            scraped_price: l.scraped_price ? Number(l.scraped_price) : null,
            product_url: l.product_url,
            scraped_at: l.scraped_at,
        })),
    }));

    return c.json({ groups, total_groups, total_listings });
});

// ── POST /reprocess ───────────────────────────────────────────────────────────
// Triggers suggestion pre-processing on demand.
// Requirements: 4.4

unmatchedSuggestionsRouter.post('/reprocess', async (c) => {
    const result = await runSuggestionPreprocessing();
    return c.json(result);
});

// ── POST /bulk-dismiss ────────────────────────────────────────────────────────
// Dismisses multiple listings by ID. Skips non-pending IDs silently.
// Requirements: 9.4, 9.5

unmatchedSuggestionsRouter.post('/bulk-dismiss', async (c) => {
    const sql = getSql();

    let body: Record<string, unknown>;
    try {
        body = await c.req.json();
    } catch {
        return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' } }, 400);
    }

    const ids = body.listing_ids;
    if (!Array.isArray(ids) || ids.length === 0) {
        return c.json({ error: { code: 'VALIDATION_ERROR', message: 'listing_ids must be a non-empty array' } }, 400);
    }

    const validIds = ids.filter((id) => Number.isInteger(id) && id > 0) as number[];
    if (validIds.length === 0) {
        return c.json({ error: { code: 'VALIDATION_ERROR', message: 'No valid listing IDs provided' } }, 400);
    }

    // Update only pending listings — skip others
    const idList = validIds.join(',');
    const updated = (await sql.unsafe(`
    UPDATE unmatched_listings
    SET status = 'dismissed'
    WHERE id IN (${idList}) AND status = 'pending'
    RETURNING id
  `)) as { id: number }[];

    const dismissed = updated.length;
    const skipped = validIds.length - dismissed;

    // Delete suggestion rows for dismissed listings
    if (dismissed > 0) {
        const dismissedIds = updated.map((r) => r.id).join(',');
        await sql.unsafe(`
      DELETE FROM unmatched_suggestions
      WHERE unmatched_listing_id IN (${dismissedIds})
    `);
    }

    return c.json({ dismissed, skipped });
});

// ── POST /bulk-approve ────────────────────────────────────────────────────────
// Links all high-confidence groups with existing_component_id to their matches.
// All operations run in a single transaction.
// Requirements: 8.3, 8.4, 8.6

unmatchedSuggestionsRouter.post('/bulk-approve', async (c) => {
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
        return c.json({ error: { code: 'VALIDATION_ERROR', message: 'canonical_names must be a non-empty array' } }, 400);
    }

    // Fetch all high-confidence groups with existing_component_id for the given canonical names
    const groups = (await sql`
    SELECT
      us.canonical_name,
      us.existing_component_id,
      ul.id          AS listing_id,
      ul.retailer_id,
      ul.product_url,
      ul.scraped_name
    FROM unmatched_suggestions us
    JOIN unmatched_listings ul ON ul.id = us.unmatched_listing_id
    WHERE us.confidence = 'high'
      AND us.existing_component_id IS NOT NULL
      AND ul.status = 'pending'
      AND us.canonical_name = ANY(${canonicalNames as string[]})
  `) as {
        canonical_name: string;
        existing_component_id: number;
        listing_id: number;
        retailer_id: number;
        product_url: string;
        scraped_name: string;
    }[];

    if (groups.length === 0) {
        return c.json({ approved_groups: 0, linked_listings: 0, skipped_groups: canonicalNames.length });
    }

    let approved_groups = 0;
    let linked_listings = 0;
    const skipped_groups = canonicalNames.length - new Set(groups.map((g) => g.canonical_name)).size;

    // Execute all links in a single transaction
    await sql.begin(async (tx) => {
        for (const row of groups) {
            await tx`
        INSERT INTO scraper_mappings (component_id, retailer_id, product_url, product_identifier)
        VALUES (${row.existing_component_id}, ${row.retailer_id}, ${row.product_url}, ${row.scraped_name})
        ON CONFLICT (retailer_id, product_url) DO UPDATE SET
          component_id = EXCLUDED.component_id,
          updated_at   = NOW()
      `;
            await tx`
        UPDATE unmatched_listings
        SET status = 'linked', linked_component_id = ${row.existing_component_id}
        WHERE id = ${row.listing_id}
      `;
            await tx`
        DELETE FROM unmatched_suggestions WHERE unmatched_listing_id = ${row.listing_id}
      `;
            linked_listings++;
        }
        approved_groups = new Set(groups.map((g) => g.canonical_name)).size;
    });

    if (admin?.id) {
        await logActivity(admin.id, 'bulk_approve', 'unmatched_listings', null, {
            approved_groups,
            linked_listings,
        });
    }

    return c.json({ approved_groups, linked_listings, skipped_groups });
});

// ── POST /create-and-link ─────────────────────────────────────────────────────
// Creates a new catalog component and links all listings in the canonical group.
// Runs atomically in a single transaction.
// Requirements: 7.3, 7.4, 7.5, 7.6, 13.1, 13.2, 14.2

unmatchedSuggestionsRouter.post('/create-and-link', async (c) => {
    const sql = getSql();
    const admin = c.get('admin') as { id: number } | undefined;

    let body: Record<string, unknown>;
    try {
        body = await c.req.json();
    } catch {
        return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' } }, 400);
    }

    const { name, brand, category, specs, listing_ids, link_to_existing, existing_component_id } = body as {
        name?: string;
        brand?: string;
        category?: string;
        specs?: Record<string, unknown>;
        listing_ids?: number[];
        link_to_existing?: boolean;
        existing_component_id?: number;
    };

    // Validate required fields
    if (!name || typeof name !== 'string' || !name.trim()) {
        return c.json({ error: { code: 'VALIDATION_ERROR', message: 'name is required' } }, 400);
    }
    if (!category || typeof category !== 'string') {
        return c.json({ error: { code: 'VALIDATION_ERROR', message: 'category is required' } }, 400);
    }
    if (!Array.isArray(listing_ids) || listing_ids.length === 0) {
        return c.json({ error: { code: 'VALIDATION_ERROR', message: 'listing_ids must be a non-empty array' } }, 400);
    }

    const validListingIds = listing_ids.filter((id) => Number.isInteger(id) && id > 0) as number[];

    // Validate category-specific fields using Zod schema
    const schema = (componentSchemas as Record<string, unknown>)[category];
    if (!schema) {
        return c.json({ error: { code: 'VALIDATION_ERROR', message: `Unknown category: ${category}` } }, 400);
    }

    const componentData = { name: name.trim(), brand: brand?.trim() || undefined, ...(specs ?? {}) };
    const parseResult = (schema as { safeParse: (d: unknown) => { success: boolean; error?: { issues: unknown[] } } }).safeParse(componentData);
    if (!parseResult.success) {
        const issues = parseResult.error?.issues ?? [];
        const fieldErrors = issues.map((i: unknown) => {
            const issue = i as { path?: string[]; message?: string };
            return `${issue.path?.join('.') ?? 'field'}: ${issue.message ?? 'invalid'}`;
        }).join(', ');
        return c.json({
            error: {
                code: 'VALIDATION_ERROR',
                message: `Component validation failed: ${fieldErrors}`,
                fields: issues,
            },
        }, 400);
    }

    // If linking to existing component, skip creation
    if (link_to_existing && existing_component_id) {
        const existing = (await sql`SELECT id FROM components WHERE id = ${existing_component_id} LIMIT 1`) as { id: number }[];
        if (existing.length === 0) {
            return c.json({ error: { code: 'NOT_FOUND', message: `Component ${existing_component_id} not found` } }, 404);
        }

        // Fetch listing details for mapping
        const listings = (await sql`
      SELECT id, retailer_id, product_url, scraped_name
      FROM unmatched_listings
      WHERE id = ANY(${validListingIds as number[]}) AND status = 'pending'
    `) as { id: number; retailer_id: number; product_url: string; scraped_name: string }[];

        await sql.begin(async (tx) => {
            for (const listing of listings) {
                await tx`
          INSERT INTO scraper_mappings (component_id, retailer_id, product_url, product_identifier)
          VALUES (${existing_component_id}, ${listing.retailer_id}, ${listing.product_url}, ${listing.scraped_name})
          ON CONFLICT (retailer_id, product_url) DO UPDATE SET
            component_id = EXCLUDED.component_id,
            updated_at   = NOW()
        `;
                await tx`
          UPDATE unmatched_listings
          SET status = 'linked', linked_component_id = ${existing_component_id}
          WHERE id = ${listing.id}
        `;
                await tx`DELETE FROM unmatched_suggestions WHERE unmatched_listing_id = ${listing.id}`;
            }
        });

        if (admin?.id) {
            await logActivity(admin.id, 'create_and_link', 'unmatched_listings', existing_component_id, {
                linked_count: listings.length,
                link_to_existing: true,
            });
        }

        // Fire-and-forget: refresh suggestions for remaining pending listings
        runSuggestionPreprocessing().catch(() => { });

        return c.json({
            component_id: existing_component_id,
            component_slug: null,
            linked_count: listings.length,
        });
    }

    // Check for duplicate canonical name + category + brand before creating
    const canonicalName = name.trim();
    const brandVal = brand?.trim() ?? null;
    const duplicates = (await sql`
    SELECT id, name, brand, slug FROM components
    WHERE LOWER(name) = LOWER(${canonicalName})
      AND category = ${category}
      AND (
        ${brandVal}::text IS NULL AND brand IS NULL
        OR LOWER(brand) = LOWER(${brandVal ?? ''})
      )
    LIMIT 1
  `) as { id: number; name: string; brand: string | null; slug: string }[];

    if (duplicates.length > 0) {
        return c.json({
            error: {
                code: 'DUPLICATE_COMPONENT',
                message: `A component named "${canonicalName}" in category "${category}" already exists`,
                existing: duplicates[0],
            },
        }, 409);
    }

    // Fetch listing details
    const listings = (await sql`
    SELECT id, retailer_id, product_url, scraped_name
    FROM unmatched_listings
    WHERE id = ANY(${validListingIds as number[]}) AND status = 'pending'
  `) as { id: number; retailer_id: number; product_url: string; scraped_name: string }[];

    if (listings.length === 0) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'No pending listings found for the provided IDs' } }, 404);
    }

    // Generate slug
    const slug = await getUniqueSlug(brandVal, canonicalName);

    // Extract category-specific columns from specs
    const s = specs ?? {};
    let newComponentId: number;

    try {
        await sql.begin(async (tx) => {
            // Insert component
            const inserted = (await tx`
      INSERT INTO components (
        slug, name, brand, category,
        socket, supported_ram_types, max_ram_frequency,
        ram_type, frequency_mhz,
        length_mm, max_gpu_length_mm,
        supported_motherboards, max_cooler_height_mm,
        form_factor, height_mm,
        wattage, tdp,
        ram_slots, m2_slots, sata_ports,
        size_mm, airflow_cfm, noise_db, rgb, pack_size,
        weight_grams, thermal_conductivity, paste_type,
        is_active
      ) VALUES (
        ${slug}, ${canonicalName}, ${brandVal}, ${category},
        ${(s.socket as string) ?? null},
        ${(s.supported_ram_types as string[]) ?? null},
        ${(s.max_ram_frequency as number) ?? null},
        ${(s.ram_type as string) ?? null},
        ${(s.frequency_mhz as number) ?? null},
        ${(s.length_mm as number) ?? null},
        ${(s.max_gpu_length_mm as number) ?? null},
        ${(s.supported_motherboards as string[]) ?? null},
        ${(s.max_cooler_height_mm as number) ?? null},
        ${(s.form_factor as string) ?? null},
        ${(s.height_mm as number) ?? null},
        ${(s.wattage as number) ?? null},
        ${(s.tdp as number) ?? null},
        ${(s.ram_slots as number) ?? null},
        ${(s.m2_slots as number) ?? null},
        ${(s.sata_ports as number) ?? null},
        ${(s.size_mm as number) ?? null},
        ${(s.airflow_cfm as number) ?? null},
        ${(s.noise_db as number) ?? null},
        ${(s.rgb as boolean) ?? null},
        ${(s.pack_size as number) ?? null},
        ${(s.weight_grams as number) ?? null},
        ${(s.thermal_conductivity as number) ?? null},
        ${(s.paste_type as string) ?? null},
        true
      )
      RETURNING id
    `) as { id: number }[];

            newComponentId = inserted[0].id;

            // Create scraper_mappings + update listing statuses
            for (const listing of listings) {
                await tx`
        INSERT INTO scraper_mappings (component_id, retailer_id, product_url, product_identifier)
        VALUES (${newComponentId}, ${listing.retailer_id}, ${listing.product_url}, ${listing.scraped_name})
        ON CONFLICT (retailer_id, product_url) DO UPDATE SET
          component_id = EXCLUDED.component_id,
          updated_at   = NOW()
      `;
                await tx`
        UPDATE unmatched_listings
        SET status = 'linked', linked_component_id = ${newComponentId}
        WHERE id = ${listing.id}
      `;
                await tx`DELETE FROM unmatched_suggestions WHERE unmatched_listing_id = ${listing.id}`;
            }
        });
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return c.json({
            error: {
                code: 'TRANSACTION_FAILED',
                message: `Failed to create component: ${msg}`,
            },
        }, 500);
    }

    if (admin?.id) {
        await logActivity(admin.id, 'create_and_link', 'components', newComponentId!, {
            linked_count: listings.length,
            category,
        });
    }

    // Fire-and-forget: refresh suggestions for remaining pending listings
    runSuggestionPreprocessing().catch(() => { });

    return c.json({
        component_id: newComponentId!,
        component_slug: slug,
        linked_count: listings.length,
    }, 201);
});

export { unmatchedSuggestionsRouter };
