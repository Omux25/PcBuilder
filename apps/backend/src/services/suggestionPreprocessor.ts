/**
 * suggestionPreprocessor.ts — Batch suggestion pre-computation.
 *
 * Runs the Suggestion Engine against all pending unmatched listings that
 * have no cached suggestion or a stale one (older than 24 hours), then
 * upserts results into the unmatched_suggestions table.
 *
 * Called automatically at the end of every scrape session (session.ts),
 * and on demand via POST /api/admin/unmatched-listings/reprocess.
 *
 * Requirements: 4.1–4.7, 15.5
 */

import { getSql } from '../db/index.js';
import { processBatch } from './suggestionEngine.js';
import { loadAdminRules } from './keywordRulesService.js';
import { logger } from '../../scraper/utils/logger.js';
import type { CatalogComponent } from '../utils/componentMatcher.js';

export interface PreprocessResult {
  processed: number;
  skipped: number;
}

/**
 * Runs suggestion pre-processing for all pending unmatched listings
 * that have no suggestion or a suggestion older than 24 hours.
 *
 * Algorithm:
 * 1. Load all active catalog components once (single query)
 * 2. Fetch all pending listings needing suggestions
 * 3. Call processBatch() — pure, no per-listing DB queries
 * 4. Batch-upsert results into unmatched_suggestions
 *
 * Requirements: 4.1–4.7
 */
export async function runSuggestionPreprocessing(): Promise<PreprocessResult> {
  let processed = 0;
  let skipped = 0;

  const sql = getSql();

  // Step 1: Load all active catalog components once
  const catalog = (await sql`
    SELECT id, name, brand, category
    FROM components
    WHERE is_active = true
  `) as CatalogComponent[];

  // Step 1b: Load admin keyword rules once per batch
  let adminRules: Awaited<ReturnType<typeof loadAdminRules>> = [];
  try {
    adminRules = await loadAdminRules();
  } catch (err) {
    await logger.error(
      `[SUGGESTION-PREPROCESSOR] Failed to load admin rules: ${err instanceof Error ? err.message : String(err)}`,
    );
    return { processed: 0, skipped: 0 };
  }

  // Step 2: Fetch pending listings with no suggestion or stale suggestion (>24h)
  const pending = (await sql`
    SELECT ul.id, ul.scraped_name
    FROM unmatched_listings ul
    LEFT JOIN unmatched_suggestions us ON us.unmatched_listing_id = ul.id
    WHERE ul.status = 'pending'
      AND ul.scraped_name IS NOT NULL
      AND ul.scraped_name != ''
      AND (
        us.id IS NULL
        OR us.computed_at < NOW() - INTERVAL '24 hours'
      )
    ORDER BY ul.scraped_at DESC
  `) as { id: number; scraped_name: string }[];

  if (pending.length === 0) return { processed, skipped };

  // Step 3: Run batch suggestion (pure, no DB queries inside)
  const suggestions = processBatch(pending, catalog, adminRules);

  // Step 4: Upsert results into unmatched_suggestions
  for (const listing of pending) {
    const suggestion = suggestions.get(listing.id);
    if (!suggestion) {
      skipped++;
      continue;
    }

    try {
      await sql`
        INSERT INTO unmatched_suggestions (
          unmatched_listing_id,
          category,
          confidence,
          canonical_name,
          brand,
          existing_component_id,
          specs_hint,
          computed_at
        )
        VALUES (
          ${listing.id},
          ${suggestion.category},
          ${suggestion.confidence},
          ${suggestion.canonical_name},
          ${suggestion.brand},
          ${suggestion.existing_component_id},
          ${Object.keys(suggestion.specs_hint).length > 0
          ? suggestion.specs_hint as Record<string, unknown>
          : null},
          NOW()
        )
        ON CONFLICT (unmatched_listing_id) DO UPDATE SET
          category              = EXCLUDED.category,
          confidence            = EXCLUDED.confidence,
          canonical_name        = EXCLUDED.canonical_name,
          brand                 = EXCLUDED.brand,
          existing_component_id = EXCLUDED.existing_component_id,
          specs_hint            = EXCLUDED.specs_hint,
          computed_at           = NOW()
      `;
      processed++;
    } catch (err) {
      // Log and continue — never abort the batch for a single failure
      skipped++;
      await logger.error(
        `[SUGGESTION-PREPROCESSOR] Failed to upsert suggestion for listing ${listing.id}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  if (processed > 0) {
    await logger.info(
      `[SUGGESTION-PREPROCESSOR] ${processed} suggestion(s) computed, ${skipped} skipped`,
    );
  }

  return { processed, skipped };
}
