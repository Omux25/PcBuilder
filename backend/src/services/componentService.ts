/**
 * Component Service — Data Access Layer
 * Queries the components and prices tables using Bun.sql.
 *
 * Requirements: 1.1, 1.7, 7.1, 7.3, 8.1, 11.1, 13.1, 13.3
 */

import { sql as bunSql } from 'bun';
import { getUniqueSlug } from './slugService';

// ── Dependency injection ─────────────────────────────────────────────────────

type SqlFn = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown[]>;

let _sql: SqlFn = bunSql as unknown as SqlFn;

export function setSql(mockSql: SqlFn): void {
  _sql = mockSql;
}

export function resetSql(): void {
  _sql = bunSql as unknown as SqlFn;
}

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
  const { category, socket, ram_type, brand, search } = filters;
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
  const offset = (page - 1) * limit;

  // Build WHERE conditions as an array, then join with AND.
  // Bun.sql doesn't support dynamic WHERE building natively, so we use
  // a single query with all conditions using COALESCE/IS NULL tricks.
  const rows = (await _sql`
    SELECT *, COUNT(*) OVER() AS total_count
    FROM components
    WHERE is_active = true
      AND (${category ?? null}::text IS NULL OR category = ${category ?? null})
      AND (${socket ?? null}::text IS NULL OR socket = ${socket ?? null})
      AND (${ram_type ?? null}::text IS NULL OR ram_type = ${ram_type ?? null})
      AND (${brand ?? null}::text IS NULL OR LOWER(brand) = LOWER(${brand ?? null}))
      AND (${search ?? null}::text IS NULL OR (
            LOWER(name) LIKE LOWER('%' || ${search ?? null} || '%')
            OR LOWER(brand) LIKE LOWER('%' || ${search ?? null} || '%')
            OR LOWER(slug) LIKE LOWER('%' || ${search ?? null} || '%')
          ))
    ORDER BY id ASC
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
  const rows = (await _sql`
    SELECT * FROM components
    WHERE id = ${id} AND is_active = true
    LIMIT 1
  `) as Component[];

  if (rows.length === 0) {
    const err = new Error(`Component with id ${id} not found`);
    (err as NodeJS.ErrnoException).code = 'COMPONENT_NOT_FOUND';
    throw err;
  }

  return rows[0];
}

/**
 * Returns a single active component by its slug.
 * Throws COMPONENT_NOT_FOUND if not found or inactive.
 */
async function getComponentBySlug(slug: string): Promise<Component> {
  const rows = (await _sql`
    SELECT * FROM components
    WHERE slug = ${slug} AND is_active = true
    LIMIT 1
  `) as Component[];

  if (rows.length === 0) {
    const err = new Error(`Component with slug "${slug}" not found`);
    (err as NodeJS.ErrnoException).code = 'COMPONENT_NOT_FOUND';
    throw err;
  }

  return rows[0];
}

/**
 * Returns all price offers for a component, sorted by ascending price.
 */
async function getPricesByComponentId(id: number): Promise<PriceOffer[]> {
  return _sql`
    SELECT
      r.id          AS retailer_id,
      r.name        AS retailer_name,
      p.price,
      p.in_stock,
      p.product_url,
      p.last_updated
    FROM prices p
    JOIN retailers r ON r.id = p.retailer_id
    WHERE p.component_id = ${id}
    ORDER BY p.price ASC
  ` as Promise<PriceOffer[]>;
}

// ── Admin Service Functions ──────────────────────────────────────────────────

/**
 * Inserts a new component with auto-generated slug.
 */
async function createComponent(data: Record<string, unknown>): Promise<Component> {
  const {
    name, brand, category, description, specs, image_url, release_year,
    socket, supported_ram_types, max_ram_frequency, ram_type,
    frequency_mhz, length_mm, max_gpu_length_mm, wattage, tdp,
  } = data as Record<string, unknown>;

  const slug = await getUniqueSlug(brand as string | null, name as string);

  const rows = (await _sql`
    INSERT INTO components (
      slug, name, brand, category, description, specs, image_url, release_year,
      socket, supported_ram_types, max_ram_frequency, ram_type,
      frequency_mhz, length_mm, max_gpu_length_mm, wattage, tdp,
      is_active
    ) VALUES (
      ${slug},
      ${name as string},
      ${(brand ?? null) as string | null},
      ${category as string},
      ${(description ?? null) as string | null},
      ${(specs ?? null) as Record<string, unknown> | null},
      ${(image_url ?? null) as string | null},
      ${(release_year ?? null) as number | null},
      ${(socket ?? null) as string | null},
      ${(supported_ram_types ?? null) as string[] | null},
      ${(max_ram_frequency ?? null) as number | null},
      ${(ram_type ?? null) as string | null},
      ${(frequency_mhz ?? null) as number | null},
      ${(length_mm ?? null) as number | null},
      ${(max_gpu_length_mm ?? null) as number | null},
      ${(wattage ?? null) as number | null},
      ${(tdp ?? null) as number | null},
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
async function updateComponent(id: number, data: Record<string, unknown>): Promise<Component> {
  const {
    name, brand, category, description, specs, image_url, release_year,
    socket, supported_ram_types, max_ram_frequency, ram_type,
    frequency_mhz, length_mm, max_gpu_length_mm, wattage, tdp,
  } = data as Record<string, unknown>;

  const slug = await getUniqueSlug(brand as string | null, name as string, id);

  const rows = (await _sql`
    UPDATE components SET
      slug                = ${slug},
      name                = ${name as string},
      brand               = ${(brand ?? null) as string | null},
      category            = ${category as string},
      description         = ${(description ?? null) as string | null},
      specs               = ${(specs ?? null) as Record<string, unknown> | null},
      image_url           = ${(image_url ?? null) as string | null},
      release_year        = ${(release_year ?? null) as number | null},
      socket              = ${(socket ?? null) as string | null},
      supported_ram_types = ${(supported_ram_types ?? null) as string[] | null},
      max_ram_frequency   = ${(max_ram_frequency ?? null) as number | null},
      ram_type            = ${(ram_type ?? null) as string | null},
      frequency_mhz       = ${(frequency_mhz ?? null) as number | null},
      length_mm           = ${(length_mm ?? null) as number | null},
      max_gpu_length_mm   = ${(max_gpu_length_mm ?? null) as number | null},
      wattage             = ${(wattage ?? null) as number | null},
      tdp                 = ${(tdp ?? null) as number | null},
      updated_at          = NOW()
    WHERE id = ${id}
    RETURNING *
  `) as Component[];

  if (rows.length === 0) {
    const err = new Error(`Component with id ${id} not found`);
    (err as NodeJS.ErrnoException).code = 'COMPONENT_NOT_FOUND';
    throw err;
  }

  return rows[0];
}

/**
 * Soft-deletes a component by setting is_active = false.
 * Throws COMPONENT_NOT_FOUND if no component matches.
 */
async function deactivateComponent(id: number): Promise<Component> {
  const rows = (await _sql`
    UPDATE components SET is_active = false, updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `) as Component[];

  if (rows.length === 0) {
    const err = new Error(`Component with id ${id} not found`);
    (err as NodeJS.ErrnoException).code = 'COMPONENT_NOT_FOUND';
    throw err;
  }

  return rows[0];
}

/**
 * Hard-deletes a component. Returns HTTP 409 error if linked prices or mappings exist.
 * Throws COMPONENT_NOT_FOUND if no component matches.
 * Throws COMPONENT_HAS_DEPENDENCIES if linked records exist.
 */
async function deleteComponent(id: number): Promise<void> {
  // Check for linked prices
  const priceLinks = (await _sql`
    SELECT COUNT(id) AS cnt FROM prices WHERE component_id = ${id}
  `) as { cnt: string }[];

  if (parseInt(priceLinks[0].cnt, 10) > 0) {
    const err = new Error(`Component ${id} has linked price records and cannot be deleted`);
    (err as NodeJS.ErrnoException).code = 'COMPONENT_HAS_DEPENDENCIES';
    throw err;
  }

  // Check for linked scraper mappings
  const mappingLinks = (await _sql`
    SELECT COUNT(id) AS cnt FROM scraper_mappings WHERE component_id = ${id}
  `) as { cnt: string }[];

  if (parseInt(mappingLinks[0].cnt, 10) > 0) {
    const err = new Error(`Component ${id} has linked scraper mappings and cannot be deleted`);
    (err as NodeJS.ErrnoException).code = 'COMPONENT_HAS_DEPENDENCIES';
    throw err;
  }

  const rows = (await _sql`
    DELETE FROM components WHERE id = ${id} RETURNING id
  `) as { id: number }[];

  if (rows.length === 0) {
    const err = new Error(`Component with id ${id} not found`);
    (err as NodeJS.ErrnoException).code = 'COMPONENT_NOT_FOUND';
    throw err;
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
