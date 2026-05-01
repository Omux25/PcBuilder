/**
 * Slug Service — Database-aware slug generation.
 *
 * Wraps the pure slugify utilities with a DB lookup to guarantee
 * uniqueness across all existing component slugs.
 */

import { getSql } from '../db/index.js';
import { componentSlug, generateUniqueSlug } from '../utils/slugify.js';

// ── Service ──────────────────────────────────────────────────────────────────

/**
 * Generates a unique slug for a new component.
 *
 * 1. Builds a base slug from brand + name using slugify()
 * 2. Queries the DB for all existing slugs that start with the base slug
 * 3. Returns the base slug if it's free, or appends a numeric suffix if taken
 *
 * @param brand - Component brand (e.g. "AMD") — may be null
 * @param name  - Component name (e.g. "Ryzen 5 7600X")
 * @param excludeId - Optional component ID to exclude (used when updating an existing component)
 */
export async function getUniqueSlug(
  brand: string | null | undefined,
  name: string,
  excludeId?: number
): Promise<string> {
  const sql = getSql();
  const base = componentSlug(brand, name);

  // Fetch all slugs that could collide (those starting with the base slug)
  let rows: { slug: string }[];

  if (excludeId !== undefined) {
    rows = (await sql`
      SELECT slug FROM components
      WHERE slug LIKE ${base + '%'}
        AND id != ${excludeId}
    `) as { slug: string }[];
  } else {
    rows = (await sql`
      SELECT slug FROM components
      WHERE slug LIKE ${base + '%'}
    `) as { slug: string }[];
  }

  const existingSlugs = new Set(rows.map((r) => r.slug));
  return generateUniqueSlug(base, existingSlugs);
}
