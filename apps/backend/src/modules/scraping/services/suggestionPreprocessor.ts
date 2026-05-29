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

import { getSql } from '../../../core/db/index.js';
import { processBatch } from './suggestionEngine.js';
import { loadAdminRules } from './keywordRulesService.js';
import { loadAliasRules } from './aliasRulesService.js';
import { logger } from '../engine/utils/logger.js';
import type { CatalogComponent } from '../../../core/utils/componentMatcher.js';

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
export async function runSuggestionPreprocessing(force = false): Promise<PreprocessResult> {
  let processed = 0;
  let skipped = 0;

  const sql = getSql();

  // Step 1: Load all active catalog components once
  const catalog = (await sql`
    SELECT id, name, brand, category
    FROM components
    WHERE is_active = true
  `) as CatalogComponent[];

  // Step 1b: Load admin keyword rules & alias rules once per batch
  let adminRules: Awaited<ReturnType<typeof loadAdminRules>> = [];
  let aliasRules: Awaited<ReturnType<typeof loadAliasRules>> = [];
  try {
    adminRules = await loadAdminRules();
    aliasRules = await loadAliasRules();
  } catch (err) {
    await logger.error(
      `[SUGGESTION-PREPROCESSOR] Failed to load rules: ${err instanceof Error ? err.message : String(err)}`,
    );
    return { processed: 0, skipped: 0 };
  }

  // Step 2: Fetch pending listings with no suggestion or stale suggestion (>24h)
  // If force=true (e.g. triggered by a new keyword rule), reprocess ALL pending listings
  // so the new rule is applied immediately even to listings with a cached suggestion.
  const pending = (await sql`
    SELECT ul.id, ul.scraped_name, ul.product_url, ul.manual_category
    FROM unmatched_listings ul
    LEFT JOIN unmatched_suggestions us ON us.unmatched_listing_id = ul.id
    WHERE ul.status = 'pending'
      AND ul.scraped_name IS NOT NULL
      AND ul.scraped_name != ''
      AND (
        ${force} = true
        OR us.id IS NULL
        OR us.computed_at < NOW() - INTERVAL '24 hours'
      )
    ORDER BY ul.scraped_at DESC
  `) as { id: number; scraped_name: string; product_url: string; manual_category: string | null }[];

  if (pending.length === 0) return { processed, skipped };

  // Step 3: Run batch suggestion in chunks, yielding to the event loop so Hono can respond in real-time
  const suggestions = new Map<number, any>();
  const SUGGESTION_BATCH_SIZE = 50;
  for (let i = 0; i < pending.length; i += SUGGESTION_BATCH_SIZE) {
    const chunk = pending.slice(i, i + SUGGESTION_BATCH_SIZE);
    const chunkSuggestions = processBatch(chunk, catalog, adminRules, aliasRules);
    for (const [id, suggestion] of chunkSuggestions) {
      suggestions.set(id, suggestion);
    }
    // Yield execution to the event loop to let Hono handle web requests and log queries
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  // Step 4: Batch upsert results into unmatched_suggestions
  const upsertRows: any[] = [];
  for (const listing of pending) {
    const suggestion = suggestions.get(listing.id);
    if (!suggestion) {
      skipped++;
      continue;
    }

    if (listing.manual_category === 'standby') {
      suggestion.category = null;
      suggestion.confidence = 'low';
      suggestion.canonical_name = listing.scraped_name;
      suggestion.existing_component_id = null;
    } else if (listing.manual_category) {
      suggestion.category = listing.manual_category as any;
      suggestion.confidence = 'high';
    }

    upsertRows.push({
      unmatched_listing_id: listing.id,
      category: suggestion.category || null,
      confidence: suggestion.confidence,
      canonical_name: suggestion.canonical_name || listing.scraped_name,
      brand: suggestion.brand || null,
      existing_component_id: suggestion.existing_component_id || null,
      specs_hint: suggestion.specs_hint || null,
      computed_at: new Date()
    });
  }

  if (upsertRows.length > 0) {
    try {
      const BATCH = 200;
      for (let i = 0; i < upsertRows.length; i += BATCH) {
        const batch = upsertRows.slice(i, i + BATCH);
        await sql`
          INSERT INTO unmatched_suggestions ${sql(batch)}
          ON CONFLICT (unmatched_listing_id)
          DO UPDATE SET
            category = EXCLUDED.category,
            confidence = EXCLUDED.confidence,
            canonical_name = EXCLUDED.canonical_name,
            brand = EXCLUDED.brand,
            existing_component_id = EXCLUDED.existing_component_id,
            specs_hint = EXCLUDED.specs_hint,
            computed_at = EXCLUDED.computed_at
        `;
        processed += batch.length;
      }
    } catch (err) {
      await logger.error(
        `[SUGGESTION-PREPROCESSOR] Bulk upsert failed: ${err instanceof Error ? err.message : String(err)}`,
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
