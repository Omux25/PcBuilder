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

import { sql as bunSql } from 'bun';
import { findBestMatch, type CatalogComponent } from '../src/utils/componentMatcher.js';
import { logger } from './utils/logger.js';

// ── Dependency injection ──────────────────────────────────────────────────────

type SqlFn = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown[]>;
let _sql: SqlFn = bunSql as unknown as SqlFn;

export function setSql(mockSql: SqlFn): void { _sql = mockSql; }
export function resetSql(): void { _sql = bunSql as unknown as SqlFn; }

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
 */
export async function autoMap(): Promise<AutoMapResult> {
  let mapped = 0;
  let skipped = 0;

  // Load all active catalog components once
  const components = (await _sql`
    SELECT id, name, brand, category
    FROM components
    WHERE is_active = true
  `) as CatalogComponent[];

  if (components.length === 0) return { mapped, skipped };

  // Fetch all pending unmatched listings (status = 'pending', has a scraped name)
  const pending = (await _sql`
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
      continue;
    }

    try {
      // Create the scraper_mapping
      await _sql`
        INSERT INTO scraper_mappings (component_id, retailer_id, product_url, product_identifier)
        VALUES (
          ${match.componentId},
          ${listing.retailer_id},
          ${listing.product_url},
          ${listing.scraped_name}
        )
        ON CONFLICT (retailer_id, product_url) DO NOTHING
      `;

      // Mark the listing as linked
      await _sql`
        UPDATE unmatched_listings
        SET status = 'linked', linked_component_id = ${match.componentId}
        WHERE id = ${listing.id}
      `;

      mapped++;
    } catch {
      // Conflict or DB error — skip silently, listing stays pending
      skipped++;
    }
  }

  if (mapped > 0) {
    await logger.info(
      `Auto-mapper: ${mapped} new mapping(s) created, ${skipped} unrecognized`,
    );
  }

  return { mapped, skipped };
}
