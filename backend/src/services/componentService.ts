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

// Re-export DI helpers from centralized module for test compatibility
export { setSql, resetSql } from '../db/index.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface Component {
  id: number;
  slug: string;
  name: string;
  brand?: string;
  category: string;
  description?: string;
  specs?: Record<string, unknown>;
  image_url?: string;
  release_year?: number;
  is_active: boolean;
  // Legacy flat columns — still used by compatibility engine
  socket?: string;
  supported_ram_types?: string[];
  max_ram_frequency?: number;
  ram_type?: string;
  frequency_mhz?: number;
  length_mm?: number;
  max_gpu_length_mm?: number;
  wattage?: number;
  tdp?: number;
  created_at: string;
  updated_at: string;
}

export interface PriceOffer {
  retailer_id: number;
  retailer_name: string;
  price: number;
  in_stock: boolean;
  product_url: string;
  variant_label: string | null;
  variant_details: Record<string, unknown> | null;
  last_updated: string;
}

export interface ComponentListResult {
  components: Component[];
  total: number;
}

// ── Public Service Functions ─────────────────────────────────────────────────

/**
 * Returns a paginated list of active components with optional filters.
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
  } = {}
): Promise<ComponentListResult> {
  const sql = getSql();
  const { category, socket, ram_type, brand, search } = filters;
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
  const offset = (page - 1) * limit;

  // Normalize search: strip hyphens and special chars so "intel 14 4343" matches "i7-14343"
  const normalizedSearch = search
    ? search.replace(/[-_./,;:()]/g, ' ').replace(/\s+/g, ' ').trim()
    : null;
  const safeSearch = normalizedSearch
    ? normalizedSearch.replace(/%/g, '\\%').replace(/_/g, '\\_')
    : null;

  // Build WHERE conditions as an array, then join with AND.
  // Bun.sql doesn't support dynamic WHERE building natively, so we use
  // a single query with all conditions using COALESCE/IS NULL tricks.
  const rows = (await sql`
    SELECT *, COUNT(*) OVER() AS total_count
    FROM components
    WHERE is_active = true
      AND (${category ?? null}::text IS NULL OR category = ${category ?? null})
      AND (${socket ?? null}::text IS NULL OR socket = ${socket ?? null})
      AND (${ram_type ?? null}::text IS NULL OR ram_type = ${ram_type ?? null})
      AND (${brand ?? null}::text IS NULL OR LOWER(brand) = LOWER(${brand ?? null}))
      AND (${safeSearch}::text IS NULL OR (
            LOWER(REGEXP_REPLACE(name, '[-_./,;:()\s]+', ' ', 'g')) LIKE LOWER('%' || ${safeSearch} || '%') ESCAPE '\\'
            OR LOWER(brand) LIKE LOWER('%' || ${safeSearch} || '%') ESCAPE '\\'
            OR LOWER(REGEXP_REPLACE(slug, '[-_./,;:()\s]+', ' ', 'g')) LIKE LOWER('%' || ${safeSearch} || '%') ESCAPE '\\'
          ))
    ORDER BY name ASC
    LIMIT ${limit} OFFSET ${offset}
  `) as (Component & { total_count: string })[];

  const total = rows.length > 0 ? parseInt(rows[0].total_count, 10) : 0;
  const components = rows.map(({ total_count: _tc, ...c }) => c as Component);

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
  `) as Component[];

  if (rows.length === 0) {
    throw new AppError('COMPONENT_NOT_FOUND', `Composant avec l'identifiant ${id} introuvable`, 404);
  }

  return rows[0];
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
  `) as Component[];

  if (rows.length === 0) {
    throw new AppError('COMPONENT_NOT_FOUND', `Composant "${slug}" introuvable`, 404);
  }

  return rows[0];
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
 * Inserts a new component with auto-generated slug.
 */
async function createComponent(data: ComponentInput): Promise<Component> {
  const sql = getSql();
  const {
    name, brand, category, description, specs, image_url, release_year,
  } = data as ComponentInput & { description?: string; specs?: Record<string, unknown>; image_url?: string; release_year?: number };

  // Extract category-specific fields safely (fallback to specs JSON if not at root)
  const d = data as Record<string, unknown>;
  const s = data.specs as Record<string, unknown> || {};
  const socket              = (d.socket ?? s.socket)                            as string | undefined;
  const supported_ram_types = (d.supported_ram_types ?? s.supported_ram_types)  as string[] | undefined;
  const max_ram_frequency   = (d.max_ram_frequency ?? s.max_ram_frequency)      as number | undefined;
  const ram_type            = (d.ram_type ?? s.ram_type)                        as string | undefined;
  const frequency_mhz       = (d.frequency_mhz ?? s.frequency_mhz)              as number | undefined;
  const length_mm           = (d.length_mm ?? s.length_mm)                      as number | undefined;
  const max_gpu_length_mm   = (d.max_gpu_length_mm ?? s.max_gpu_length_mm)      as number | undefined;
  const wattage             = (d.wattage ?? s.wattage)                          as number | undefined;
  const tdp                 = (d.tdp ?? s.tdp)                                  as number | undefined;

  const slug = await getUniqueSlug(brand ?? null, name);

  const rows = (await sql`
    INSERT INTO components (
      slug, name, brand, category, description, specs, image_url, release_year,
      socket, supported_ram_types, max_ram_frequency, ram_type,
      frequency_mhz, length_mm, max_gpu_length_mm, wattage, tdp,
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
      ${wattage ?? null},
      ${tdp ?? null},
      true
    )
    RETURNING *
  `) as Component[];

  return rows[0];
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

  const d = data as Record<string, unknown>;
  const s = data.specs as Record<string, unknown> || {};
  const socket              = (d.socket ?? s.socket)                            as string | undefined;
  const supported_ram_types = (d.supported_ram_types ?? s.supported_ram_types)  as string[] | undefined;
  const max_ram_frequency   = (d.max_ram_frequency ?? s.max_ram_frequency)      as number | undefined;
  const ram_type            = (d.ram_type ?? s.ram_type)                        as string | undefined;
  const frequency_mhz       = (d.frequency_mhz ?? s.frequency_mhz)              as number | undefined;
  const length_mm           = (d.length_mm ?? s.length_mm)                      as number | undefined;
  const max_gpu_length_mm   = (d.max_gpu_length_mm ?? s.max_gpu_length_mm)      as number | undefined;
  const wattage             = (d.wattage ?? s.wattage)                          as number | undefined;
  const tdp                 = (d.tdp ?? s.tdp)                                  as number | undefined;

  const slug = await getUniqueSlug(brand ?? null, name, id);

  const rows = (await sql`
    UPDATE components SET
      slug                = ${slug},
      name                = ${name},
      brand               = ${brand ?? null},
      category            = ${category},
      description         = ${description ?? null},
      specs               = ${(specs ?? null) as Record<string, unknown> | null},
      image_url           = ${image_url ?? null},
      release_year        = ${release_year ?? null},
      socket              = ${socket ?? null},
      supported_ram_types = ${(supported_ram_types ?? null) as string[] | null},
      max_ram_frequency   = ${max_ram_frequency ?? null},
      ram_type            = ${ram_type ?? null},
      frequency_mhz       = ${frequency_mhz ?? null},
      length_mm           = ${length_mm ?? null},
      max_gpu_length_mm   = ${max_gpu_length_mm ?? null},
      wattage             = ${wattage ?? null},
      tdp                 = ${tdp ?? null},
      updated_at          = NOW()
    WHERE id = ${id}
    RETURNING *
  `) as Component[];

  if (rows.length === 0) {
    throw new AppError('COMPONENT_NOT_FOUND', `Composant avec l'identifiant ${id} introuvable`, 404);
  }

  return rows[0];
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
  `) as Component[];

  if (rows.length === 0) {
    throw new AppError('COMPONENT_NOT_FOUND', `Composant avec l'identifiant ${id} introuvable`, 404);
  }

  return rows[0];
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
      throw new AppError('COMPONENT_NOT_FOUND', `Composant avec l'identifiant ${id} introuvable`, 404);
    }
    throw new AppError('COMPONENT_HAS_DEPENDENCIES', `Le composant ${id} possède des enregistrements liés et ne peut pas être supprimé`, 409);
  }
}

export {
  getComponents,
  getComponentById,
  getComponentBySlug,
  getPricesByComponentId,
  createComponent,
  updateComponent,
  deactivateComponent,
  deleteComponent,
};
