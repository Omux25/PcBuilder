/**
 * Component Service — Data Access Layer
 * Queries the components and prices tables using Bun.sql.
 *
 * Requirements: 1.1, 1.7, 7.1, 7.3, 8.1, 11.1, 13.1, 13.3
 */

import { getSql } from '../db/index.js';
import { getUniqueSlug } from './slugService.js';
import { AppError } from '../utils/errors.js';
import type { ComponentInput } from '../schemas/componentSchemas.js';
import { Component, PriceOffer } from '@shared/types';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ComponentListResult {
  components: Component[];
  total: number;
}

// ── Public Service Functions ─────────────────────────────────────────────────

/**
 * Normalises a search string the same way the SQL query does:
 * collapse hyphens, underscores, dots, slashes, commas, parens → space,
 * then collapse multiple spaces, lowercase, trim.
 *
 * Used so the JS-side normalisation matches the SQL REGEXP_REPLACE exactly.
 */
function normaliseSearchTerm(raw: string): string {
  return raw
    .replace(/[-_./,;:()]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Returns a paginated list of active components with optional filters.
 *
 * Search strategy (PCPartPicker-style):
 *   1. Exact token match  — every word in the query appears somewhere in
 *      the normalised "brand + name" string (order-independent).
 *   2. Prefix token match — same but each word only needs to be a prefix
 *      of a token in the target string (handles partial model numbers).
 *
 * Both passes use PostgreSQL's built-in string functions so no extension
 * (pg_trgm, full-text search) is required.
 *
 * Also returns the total count for X-Total-Count header.
 */
async function getComponents(
  filters: {
    category?: string;
    socket?: string;
    ram_type?: string;
    brand?: string;
    search?: string;
    page?: number;
    limit?: number;
    in_stock?: boolean;
    include_inactive?: boolean;
    is_active?: boolean;
  } = {}
): Promise<ComponentListResult> {
  const sql = getSql();
  const { category, socket, ram_type, brand, search, in_stock, include_inactive, is_active } = filters;
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
  const offset = (page - 1) * limit;

  if (!search || search.trim() === '') {
    // ── No search term: simple filtered list ──────────────────────────────
    const rows = (await sql`
      SELECT c.*, COUNT(*) OVER() AS total_count
      FROM components c
      WHERE (${include_inactive ? null : true}::boolean IS NULL OR c.is_active = true)
        AND (${is_active ?? null}::boolean IS NULL OR c.is_active = ${is_active ?? null})
        AND (${category ?? null}::text IS NULL OR c.category = ${category ?? null})
        AND (${socket ?? null}::text IS NULL OR c.socket = ${socket ?? null})
        AND (${ram_type ?? null}::text IS NULL OR c.ram_type = ${ram_type ?? null})
        AND (${brand ?? null}::text IS NULL OR LOWER(c.brand) = LOWER(${brand ?? null}))
        AND (
          ${in_stock ?? null}::boolean IS NULL OR
          EXISTS (SELECT 1 FROM prices p WHERE p.component_id = c.id AND p.in_stock = true) = ${in_stock ?? null}
        )
      ORDER BY c.name ASC
      LIMIT ${limit} OFFSET ${offset}
    `) as (Component & { total_count: string; search_text?: string })[];

    const total = rows.length > 0 ? parseInt(rows[0].total_count, 10) : 0;
    return { components: rows.map(({ total_count: _tc, search_text: _st, ...c }) => c as Component), total };
  }

  // ── Search: token-based matching ─────────────────────────────────────────
  //
  // Normalise the query: collapse separators to spaces, lowercase.
  // Split into tokens. Build one LIKE condition per token against the
  // normalised "brand name" concatenation.
  //
  // PostgreSQL REGEXP_REPLACE with '[^a-z0-9 ]' (after lowercasing) strips
  // everything that isn't alphanumeric or space, then we collapse spaces.
  // This means "Core i5-12400F" → "core i5 12400f" and the user query
  // "i5 12400" → tokens ["i5","12400"] both match as substrings.
  //
  // We also try a brand-only filter so "AMD" alone returns all AMD parts.

  const normQuery = normaliseSearchTerm(search);
  // Escape LIKE special chars in the normalised query
  const escapedQuery = normQuery.replace(/%/g, '\\%').replace(/_/g, '\\_');
  // Individual tokens for token-AND matching
  const tokens = normQuery.split(' ').filter(Boolean);

  // Build per-token LIKE conditions as a single string we embed via sql``
  // We cannot use dynamic sql`` calls in a loop with Bun.sql, so we pass
  // the normalised query and do the token splitting inside SQL using a
  // helper expression. Instead, we pass each token as a separate parameter
  // and build the condition with a fixed maximum of 8 tokens (enough for
  // any realistic PC component search).
  //
  // Pad the tokens array to 8 slots (null = ignored).
  const t = [...tokens, null, null, null, null, null, null, null, null].slice(0, 8) as
    (string | null)[];

  // Escape LIKE special chars in each individual token to prevent
  // underscore/percent from acting as wildcards in token matching.
  const te = t.map(tok => tok !== null ? escapeLikeToken(tok) : null);

  // The normalised searchable string for a row:
  //   LOWER(REGEXP_REPLACE(COALESCE(brand,'') || ' ' || name, '[^a-zA-Z0-9]+', ' ', 'g'))
  // Defined as a CTE so we compute it once and reference it in WHERE + ORDER BY.

  const rows = (await sql`
      WITH base AS (
        SELECT c.*,
          LOWER(REGEXP_REPLACE(
            COALESCE(c.brand, '') || ' ' || c.name,
            '[^a-zA-Z0-9]+', ' ', 'g'
          )) AS _search_text
        FROM components c
        WHERE (${include_inactive ? null : true}::boolean IS NULL OR c.is_active = true)
          AND (${is_active ?? null}::boolean IS NULL OR c.is_active = ${is_active ?? null})
          AND (${category ?? null}::text IS NULL OR c.category = ${category ?? null})
          AND (${socket ?? null}::text IS NULL OR c.socket = ${socket ?? null})
          AND (${ram_type ?? null}::text IS NULL OR c.ram_type = ${ram_type ?? null})
          AND (${brand ?? null}::text IS NULL OR LOWER(c.brand) = LOWER(${brand ?? null}))
          AND (
            ${in_stock ?? null}::boolean IS NULL OR
            EXISTS (SELECT 1 FROM prices p WHERE p.component_id = c.id AND p.in_stock = true) = ${in_stock ?? null}
          )
      )
      SELECT *,
        COUNT(*) OVER() AS total_count
      FROM base
      WHERE
        -- Each token must appear as a substring of the normalised text.
        -- Null tokens are skipped (always true).
        (${te[0]}::text IS NULL OR _search_text LIKE '%' || ${te[0]} || '%')
        AND (${te[1]}::text IS NULL OR _search_text LIKE '%' || ${te[1]} || '%')
        AND (${te[2]}::text IS NULL OR _search_text LIKE '%' || ${te[2]} || '%')
        AND (${te[3]}::text IS NULL OR _search_text LIKE '%' || ${te[3]} || '%')
        AND (${te[4]}::text IS NULL OR _search_text LIKE '%' || ${te[4]} || '%')
        AND (${te[5]}::text IS NULL OR _search_text LIKE '%' || ${te[5]} || '%')
        AND (${te[6]}::text IS NULL OR _search_text LIKE '%' || ${te[6]} || '%')
        AND (${te[7]}::text IS NULL OR _search_text LIKE '%' || ${te[7]} || '%')
      ORDER BY
        -- Exact full-query match ranks first
        CASE WHEN _search_text LIKE '%' || ${escapedQuery} || '%' THEN 0 ELSE 1 END,
        name ASC
      LIMIT ${limit} OFFSET ${offset}
    `) as (Component & { total_count: string; search_text?: string; _search_text: string })[];

  const total = rows.length > 0 ? parseInt(rows[0].total_count, 10) : 0;
  const components = rows.map(({ total_count: _tc, search_text: _st, _search_text: _cst, ...c }) => c as Component);

  return { components, total };
}

/**
 * Returns a single active component by its numeric ID.
 * Throws COMPONENT_NOT_FOUND if not found or inactive.
 */
async function getComponentById(id: number): Promise<Component> {
  const sql = getSql();
  const rows = (await sql`
    SELECT * FROM components
    WHERE id = ${id} AND is_active = true
    LIMIT 1
  `) as (Component & { search_text?: string })[];

  if (rows.length === 0) {
    throw new AppError('COMPONENT_NOT_FOUND', `Component with id ${id} not found`, 404);
  }

  const { search_text: _st, ...component } = rows[0];
  return component as Component;
}

/**
 * Returns multiple active components by their numeric IDs.
 * Used for batch restoration of build configurations.
 * Note: Bun.sql has a known issue with array parameters in IN clauses
 * ("syntax error at or near $1"). Using sql.unsafe() with integer literals
 * is safe here because ids come from our own query parsing, not raw user input.
 */
async function getComponentsByIds(ids: number[]): Promise<Component[]> {
  if (ids.length === 0) return [];
  const sql = getSql();
  const idList = ids.join(',');
  const rows = (await sql.unsafe(`
    SELECT * FROM components
    WHERE id IN (${idList}) AND is_active = true
  `)) as (Component & { search_text?: string })[];
  return rows.map(({ search_text: _st, ...c }) => c as Component);
}

/**
 * Returns a single active component by its slug.
 * Throws COMPONENT_NOT_FOUND if not found or inactive.
 */
async function getComponentBySlug(slug: string): Promise<Component> {
  const sql = getSql();
  const rows = (await sql`
    SELECT * FROM components
    WHERE slug = ${slug} AND is_active = true
    LIMIT 1
  `) as (Component & { search_text?: string })[];

  if (rows.length === 0) {
    throw new AppError('COMPONENT_NOT_FOUND', `Component "${slug}" not found`, 404);
  }

  const { search_text: _st, ...component } = rows[0];
  return component as Component;
}

/**
 * Returns all price offers for a component, sorted by ascending price.
 * Each row is a distinct variant (AIB partner, packaging, etc.).
 */
async function getPricesByComponentId(id: number): Promise<PriceOffer[]> {
  const sql = getSql();
  return sql`
    SELECT
      r.id              AS retailer_id,
      r.name            AS retailer_name,
      p.price,
      p.in_stock,
      p.product_url,
      p.variant_label,
      p.variant_details,
      p.last_updated
    FROM prices p
    JOIN retailers r ON r.id = p.retailer_id
    WHERE p.component_id = ${id}
    ORDER BY p.in_stock DESC, p.price ASC
  ` as Promise<PriceOffer[]>;
}

// ── Admin Service Functions ──────────────────────────────────────────────────

/**
 * Escapes LIKE special characters (% and _) in a search token.
 * Applied to individual tokens before embedding in LIKE '%' || token || '%'.
 */
function escapeLikeToken(token: string): string {
  return token.replace(/%/g, '\\%').replace(/_/g, '\\_');
}

/**
 * Extracts category-specific flat columns from a ComponentInput.
 * Both createComponent() and updateComponent() need the same fields —
 * this helper avoids duplicating the extraction logic.
 */
function extractComponentFields(data: ComponentInput) {
  const d = data as Record<string, unknown>;
  return {
    socket: d.socket as string | undefined,
    supported_ram_types: d.supported_ram_types as string[] | undefined,
    max_ram_frequency: d.max_ram_frequency as number | undefined,
    ram_type: d.ram_type as string | undefined,
    frequency_mhz: d.frequency_mhz as number | undefined,
    length_mm: d.length_mm as number | undefined,
    max_gpu_length_mm: d.max_gpu_length_mm as number | undefined,
    supported_motherboards: d.supported_motherboards as string[] | undefined,
    max_cooler_height_mm: d.max_cooler_height_mm as number | undefined,
    form_factor: d.form_factor as string | undefined,
    height_mm: d.height_mm as number | undefined,
    wattage: d.wattage as number | undefined,
    tdp: d.tdp as number | undefined,
  };
}

/**
 * Inserts a new component with auto-generated slug.
 */
async function createComponent(data: ComponentInput): Promise<Component> {
  const sql = getSql();
  const {
    name, brand, category, description, specs, image_url, release_year,
  } = data as ComponentInput & { description?: string; specs?: Record<string, unknown>; image_url?: string; release_year?: number };

  const {
    socket, supported_ram_types, max_ram_frequency, ram_type,
    frequency_mhz, length_mm, max_gpu_length_mm,
    supported_motherboards, max_cooler_height_mm, form_factor, height_mm,
    wattage, tdp,
  } = extractComponentFields(data);

  const slug = await getUniqueSlug(brand ?? null, name);

  const rows = (await sql`
    INSERT INTO components (
      slug, name, brand, category, description, specs, image_url, release_year,
      socket, supported_ram_types, max_ram_frequency, ram_type,
      frequency_mhz, length_mm, max_gpu_length_mm,
      supported_motherboards, max_cooler_height_mm, form_factor, height_mm,
      wattage, tdp,
      is_active
    ) VALUES (
      ${slug},
      ${name},
      ${brand ?? null},
      ${category},
      ${description ?? null},
      ${(specs ?? null) as Record<string, unknown> | null},
      ${image_url ?? null},
      ${release_year ?? null},
      ${socket ?? null},
      ${(supported_ram_types ?? null) as string[] | null},
      ${max_ram_frequency ?? null},
      ${ram_type ?? null},
      ${frequency_mhz ?? null},
      ${length_mm ?? null},
      ${max_gpu_length_mm ?? null},
      ${(supported_motherboards ?? null) as string[] | null},
      ${max_cooler_height_mm ?? null},
      ${form_factor ?? null},
      ${height_mm ?? null},
      ${wattage ?? null},
      ${tdp ?? null},
      true
    )
    RETURNING *
  `) as (Component & { search_text?: string })[];

  const { search_text: _st, ...component } = rows[0];
  return component as Component;
}

/**
 * Updates an existing component. Regenerates slug if name or brand changed.
 * Throws COMPONENT_NOT_FOUND if no component matches.
 */
async function updateComponent(id: number, data: ComponentInput): Promise<Component> {
  const sql = getSql();
  const {
    name, brand, category, description, specs, image_url, release_year,
  } = data as ComponentInput & { description?: string; specs?: Record<string, unknown>; image_url?: string; release_year?: number };

  const {
    socket, supported_ram_types, max_ram_frequency, ram_type,
    frequency_mhz, length_mm, max_gpu_length_mm,
    supported_motherboards, max_cooler_height_mm, form_factor, height_mm,
    wattage, tdp,
  } = extractComponentFields(data);

  const slug = await getUniqueSlug(brand ?? null, name, id);

  const rows = (await sql`
    UPDATE components SET
      slug                  = ${slug},
      name                  = ${name},
      brand                 = ${brand ?? null},
      category              = ${category},
      description           = ${description ?? null},
      specs                 = ${(specs ?? null) as Record<string, unknown> | null},
      image_url             = ${image_url ?? null},
      release_year          = ${release_year ?? null},
      socket                = ${socket ?? null},
      supported_ram_types   = ${(supported_ram_types ?? null) as string[] | null},
      max_ram_frequency     = ${max_ram_frequency ?? null},
      ram_type              = ${ram_type ?? null},
      frequency_mhz         = ${frequency_mhz ?? null},
      length_mm             = ${length_mm ?? null},
      max_gpu_length_mm     = ${max_gpu_length_mm ?? null},
      supported_motherboards= ${(supported_motherboards ?? null) as string[] | null},
      max_cooler_height_mm  = ${max_cooler_height_mm ?? null},
      form_factor           = ${form_factor ?? null},
      height_mm             = ${height_mm ?? null},
      wattage               = ${wattage ?? null},
      tdp                   = ${tdp ?? null},
      updated_at            = NOW()
    WHERE id = ${id}
    RETURNING *
  `) as (Component & { search_text?: string })[];

  if (rows.length === 0) {
    throw new AppError('COMPONENT_NOT_FOUND', `Component with id ${id} not found`, 404);
  }

  const { search_text: _st, ...component } = rows[0];
  return component as Component;
}

/**
 * Soft-deletes a component by setting is_active = false.
 * Throws COMPONENT_NOT_FOUND if no component matches.
 */
async function deactivateComponent(id: number): Promise<Component> {
  const sql = getSql();
  const rows = (await sql`
    UPDATE components SET is_active = false, updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `) as (Component & { search_text?: string })[];

  if (rows.length === 0) {
    throw new AppError('COMPONENT_NOT_FOUND', `Component with id ${id} not found`, 404);
  }

  const { search_text: _st, ...component } = rows[0];
  return component as Component;
}

/**
 * Hard-deletes a component. Returns HTTP 409 error if linked prices or mappings exist.
 * Throws COMPONENT_NOT_FOUND if no component matches.
 * Throws COMPONENT_HAS_DEPENDENCIES if linked records exist.
 */
async function deleteComponent(id: number): Promise<void> {
  const sql = getSql();
  const rows = (await sql`
    WITH dep_check AS (
      SELECT
        (SELECT COUNT(id) FROM prices WHERE component_id = ${id}) AS price_count,
        (SELECT COUNT(id) FROM scraper_mappings WHERE component_id = ${id}) AS mapping_count
    )
    DELETE FROM components
    WHERE id = ${id}
      AND (SELECT price_count FROM dep_check) = 0
      AND (SELECT mapping_count FROM dep_check) = 0
    RETURNING id,
      (SELECT price_count FROM dep_check) AS price_count,
      (SELECT mapping_count FROM dep_check) AS mapping_count
  `) as { id: number; price_count: string; mapping_count: string }[];

  if (rows.length === 0) {
    const exists = (await sql`SELECT id FROM components WHERE id = ${id} LIMIT 1`) as { id: number }[];
    if (exists.length === 0) {
      throw new AppError('COMPONENT_NOT_FOUND', `Component with id ${id} not found`, 404);
    }
    throw new AppError('COMPONENT_HAS_DEPENDENCIES', `Component ${id} has linked records and cannot be deleted`, 409);
  }
}

export {
  getComponents,
  getComponentById,
  getComponentsByIds,
  getComponentBySlug,
  getPricesByComponentId,
  createComponent,
  updateComponent,
  deactivateComponent,
  deleteComponent,
};
