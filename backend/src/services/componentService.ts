/**
 * Component Service — Data Access Layer
 * Queries the components and prices tables using Bun.sql.
 *
 * Requirements: 1.2, 7.1, 7.3, 11.1
 */

import { sql as bunSql } from 'bun';

// ── Dependency injection ─────────────────────────────────────────────────────
// `_sql` is the active SQL executor. Tests can replace it via `setSql()`.
// Production code always uses the real Bun.sql tagged-template function.

type SqlFn = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown[]>;

let _sql: SqlFn = bunSql as unknown as SqlFn;

/** Replace the SQL executor — used in unit tests to inject a mock. */
export function setSql(mockSql: SqlFn): void {
  _sql = mockSql;
}

/** Reset the SQL executor back to the real Bun.sql — call in afterEach/afterAll. */
export function resetSql(): void {
  _sql = bunSql as unknown as SqlFn;
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface Component {
  id: number;
  name: string;
  brand?: string;
  category: string;
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
  retailer_name: string;
  price: number;
  in_stock: boolean;
  product_url: string;
  last_updated: string;
}

// ── Service Functions ────────────────────────────────────────────────────────

/**
 * Returns all components, optionally filtered by category, socket, and/or ram_type.
 * All filters are optional — if none are provided, all components are returned.
 *
 * @param filters - Optional filter object
 * @param filters.category  - Filter by component category (e.g. 'cpu', 'gpu')
 * @param filters.socket    - Filter by socket type (e.g. 'AM5', 'LGA1700')
 * @param filters.ram_type  - Filter by RAM type (e.g. 'DDR4', 'DDR5')
 */
async function getComponents(
  filters: { category?: string; socket?: string; ram_type?: string } = {}
): Promise<Component[]> {
  const { category, socket, ram_type } = filters;

  // Build the WHERE clause dynamically based on which filters are provided.
  // Bun.sql template literals produce parameterized queries automatically.
  if (category && socket && ram_type) {
    return _sql`
      SELECT * FROM components
      WHERE category = ${category}
        AND socket = ${socket}
        AND ram_type = ${ram_type}
      ORDER BY id ASC
    ` as Promise<Component[]>;
  }

  if (category && socket) {
    return _sql`
      SELECT * FROM components
      WHERE category = ${category}
        AND socket = ${socket}
      ORDER BY id ASC
    ` as Promise<Component[]>;
  }

  if (category && ram_type) {
    return _sql`
      SELECT * FROM components
      WHERE category = ${category}
        AND ram_type = ${ram_type}
      ORDER BY id ASC
    ` as Promise<Component[]>;
  }

  if (socket && ram_type) {
    return _sql`
      SELECT * FROM components
      WHERE socket = ${socket}
        AND ram_type = ${ram_type}
      ORDER BY id ASC
    ` as Promise<Component[]>;
  }

  if (category) {
    return _sql`
      SELECT * FROM components
      WHERE category = ${category}
      ORDER BY id ASC
    ` as Promise<Component[]>;
  }

  if (socket) {
    return _sql`
      SELECT * FROM components
      WHERE socket = ${socket}
      ORDER BY id ASC
    ` as Promise<Component[]>;
  }

  if (ram_type) {
    return _sql`
      SELECT * FROM components
      WHERE ram_type = ${ram_type}
      ORDER BY id ASC
    ` as Promise<Component[]>;
  }

  // No filters — return everything
  return _sql`
    SELECT * FROM components
    ORDER BY id ASC
  ` as Promise<Component[]>;
}

/**
 * Returns a single component by its ID.
 * Throws an error with code COMPONENT_NOT_FOUND if no component matches.
 *
 * @param id - The component's primary key
 */
async function getComponentById(id: number): Promise<Component> {
  const rows = (await _sql`
    SELECT * FROM components
    WHERE id = ${id}
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
 * Returns all price offers for a given component, joined with retailer data.
 * Results are ordered by ascending price (cheapest first).
 *
 * @param id - The component's primary key
 */
async function getPricesByComponentId(id: number): Promise<PriceOffer[]> {
  return _sql`
    SELECT
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

export { getComponents, getComponentById, getPricesByComponentId };
