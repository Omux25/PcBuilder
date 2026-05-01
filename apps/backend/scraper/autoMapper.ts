/**
 * autoMapper.ts — Automatically maps unmatched_listings to catalog components
 * using the DNA-based component matcher.
 *
 * Called at the end of every scraping session. For each pending unmatched
 * listing, it runs the DNA matcher against the active catalog. If a confident
 * match is found (score = 1.0, or 0.8 for case/cooling), it creates a
 * scraper_mapping entry so the next scrape will price it correctly.
 *
 * This is the bridge between the scraper and the catalog — no manual
 * intervention needed for products the matcher can identify.
 *
 * Products the matcher cannot identify (bundles, accessories, peripherals,
 * unknown models) stay in unmatched_listings for admin review.
 */

import { findBestMatch, type CatalogComponent } from '../src/utils/componentMatcher.js';
import { logger } from './utils/logger.js';
import { getSql, setSql, resetSql } from '../src/db/index.js';

// Re-export DI helpers so tests can inject a mock SQL function.
export { setSql, resetSql };

// ── Config ────────────────────────────────────────────────────────────────────

// Categories where a partial DNA match (0.8) is acceptable.
// Case and cooling have simpler DNA — model name tokens — so 0.8 is safe.
// All other categories require a perfect 1.0 match to avoid false positives.
const PARTIAL_MATCH_CATEGORIES = new Set(['case', 'cooling']);
const PARTIAL_THRESHOLD = 0.8;

// ── Auto-mapper ───────────────────────────────────────────────────────────────

export interface AutoMapResult {
  mapped: number;
  skipped: number;
}

/**
 * Runs the DNA matcher against all pending unmatched_listings.
 * Creates scraper_mapping entries for confident matches.
 * Leaves unrecognized products (accessories, bundles, etc.) for admin review.
 *
 * @param onProgress - optional callback called after each listing is processed
 */
export async function autoMap(onProgress?: (done: number, total: number) => void): Promise<AutoMapResult> {
  let mapped = 0;
  let skipped = 0;

  const sql = getSql();

  // Load all active catalog components once
  const components = (await sql`
    SELECT id, name, brand, category
    FROM components
    WHERE is_active = true
  `) as CatalogComponent[];

  if (components.length === 0) return { mapped, skipped };

  // Fetch all pending unmatched listings (status = 'pending', has a scraped name)
  const pending = (await sql`
    SELECT id, retailer_id, product_url, scraped_name
    FROM unmatched_listings
    WHERE status = 'pending'
      AND scraped_name IS NOT NULL
      AND scraped_name != ''
    ORDER BY scraped_at DESC
  `) as { id: number; retailer_id: number; product_url: string; scraped_name: string }[];

  if (pending.length === 0) return { mapped, skipped };

  for (const listing of pending) {
    // Try perfect DNA match first
    let match = findBestMatch(listing.scraped_name, components, 1.0);

    // For case/cooling, allow partial match
    if (!match) {
      const partial = findBestMatch(listing.scraped_name, components, PARTIAL_THRESHOLD);
      if (partial) {
        const cat = components.find(c => c.id === partial.componentId)?.category ?? '';
        if (PARTIAL_MATCH_CATEGORIES.has(cat)) match = partial;
      }
    }

    if (!match) {
      skipped++;
    } else {
      try {
        await sql`
          INSERT INTO scraper_mappings (component_id, retailer_id, product_url, product_identifier)
          VALUES (
            ${match.componentId},
            ${listing.retailer_id},
            ${listing.product_url},
            ${listing.scraped_name}
          )
          ON CONFLICT (retailer_id, product_url) DO NOTHING
        `;
        await sql`
          UPDATE unmatched_listings
          SET status = 'linked', linked_component_id = ${match.componentId}
          WHERE id = ${listing.id}
        `;
        mapped++;
      } catch {
        skipped++;
      }
    }

    onProgress?.(mapped + skipped, pending.length);
  }

  if (mapped > 0) {
    await logger.info(
      `Auto-mapper: ${mapped} new mapping(s) created, ${skipped} unrecognized`,
    );
  }

  return { mapped, skipped };
}
