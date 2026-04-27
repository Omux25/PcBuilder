/**
 * Retailer Service — Data Access Layer
 * Manages retailer CRUD and scraping configuration.
 *
 * Requirements: 4.1, 4.3
 */

import { sql as bunSql } from 'bun';

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

export interface Retailer {
  id: number;
  name: string;
  base_url: string;
  logo_url?: string;
  country: string;
  is_active: boolean;
  scraping_interval_hours: number;
  last_scrape_at?: string;
  last_scrape_status?: string;
  notes?: string;
}

export interface RetailerWithStats extends Retailer {
  price_records_count: number;
}

// ── Service Functions ────────────────────────────────────────────────────────

/**
 * Returns all retailers with their price record counts.
 *
 * @param includeInactive - If true, includes inactive retailers (default false)
 */
async function getRetailers(includeInactive = false): Promise<RetailerWithStats[]> {
  if (includeInactive) {
    return _sql`
      SELECT
        r.*,
        COUNT(p.id) AS price_records_count
      FROM retailers r
      LEFT JOIN prices p ON p.retailer_id = r.id
      GROUP BY r.id
      ORDER BY r.name ASC
    ` as Promise<RetailerWithStats[]>;
  }

  return _sql`
    SELECT
      r.*,
      COUNT(p.id) AS price_records_count
    FROM retailers r
    LEFT JOIN prices p ON p.retailer_id = r.id
    WHERE r.is_active = true
    GROUP BY r.id
    ORDER BY r.name ASC
  ` as Promise<RetailerWithStats[]>;
}

/**
 * Returns a single retailer by ID.
 * Throws RETAILER_NOT_FOUND if no retailer matches.
 */
async function getRetailerById(id: number): Promise<RetailerWithStats> {
  const rows = (await _sql`
    SELECT
      r.*,
      COUNT(p.id) AS price_records_count
    FROM retailers r
    LEFT JOIN prices p ON p.retailer_id = r.id
    WHERE r.id = ${id}
    GROUP BY r.id
    LIMIT 1
  `) as RetailerWithStats[];

  if (rows.length === 0) {
    const err = new Error(`Retailer with id ${id} not found`);
    (err as NodeJS.ErrnoException).code = 'RETAILER_NOT_FOUND';
    throw err;
  }

  return rows[0];
}

/**
 * Creates a new retailer.
 */
async function createRetailer(data: {
  name: string;
  base_url: string;
  logo_url?: string;
  country?: string;
  scraping_interval_hours?: number;
  notes?: string;
}): Promise<Retailer> {
  const rows = (await _sql`
    INSERT INTO retailers (name, base_url, logo_url, country, is_active, scraping_interval_hours, notes)
    VALUES (
      ${data.name},
      ${data.base_url},
      ${data.logo_url ?? null},
      ${data.country ?? 'MA'},
      true,
      ${data.scraping_interval_hours ?? 24},
      ${data.notes ?? null}
    )
    RETURNING *
  `) as Retailer[];

  return rows[0];
}

/**
 * Updates an existing retailer.
 * Throws RETAILER_NOT_FOUND if no retailer matches.
 */
async function updateRetailer(
  id: number,
  data: Partial<{
    name: string;
    base_url: string;
    logo_url: string;
    country: string;
    is_active: boolean;
    scraping_interval_hours: number;
    notes: string;
  }>
): Promise<Retailer> {
  const rows = (await _sql`
    UPDATE retailers SET
      name                    = COALESCE(${data.name ?? null}, name),
      base_url                = COALESCE(${data.base_url ?? null}, base_url),
      logo_url                = COALESCE(${data.logo_url ?? null}, logo_url),
      country                 = COALESCE(${data.country ?? null}, country),
      is_active               = COALESCE(${data.is_active ?? null}, is_active),
      scraping_interval_hours = COALESCE(${data.scraping_interval_hours ?? null}, scraping_interval_hours),
      notes                   = COALESCE(${data.notes ?? null}, notes)
    WHERE id = ${id}
    RETURNING *
  `) as Retailer[];

  if (rows.length === 0) {
    const err = new Error(`Retailer with id ${id} not found`);
    (err as NodeJS.ErrnoException).code = 'RETAILER_NOT_FOUND';
    throw err;
  }

  return rows[0];
}

/**
 * Updates the scrape status after a scraping session completes.
 */
async function updateScrapeStatus(
  id: number,
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED'
): Promise<void> {
  await _sql`
    UPDATE retailers
    SET last_scrape_at = NOW(), last_scrape_status = ${status}
    WHERE id = ${id}
  `;
}

export { getRetailers, getRetailerById, createRetailer, updateRetailer, updateScrapeStatus };
