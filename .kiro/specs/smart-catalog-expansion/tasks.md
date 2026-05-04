# Implementation Plan: Smart Catalog Expansion Engine

## Overview

Purely additive implementation. New migration, new services, new routes, new UI components. The only existing files touched are `session.ts` (one new function call) and `shared/types.ts` (two new category values). Every task ends with a test run confirming the 606-test baseline still passes.

## Tasks

- [x] 1. Create migration 023 — new categories, columns, and unmatched_suggestions table
  - Create `apps/backend/src/db/migrations/023_smart_catalog_expansion.sql`
  - Drop and re-add `components_category_check` to include `fan` and `thermal_paste`
  - Add fan columns: `size_mm SMALLINT`, `airflow_cfm NUMERIC(6,2)`, `noise_db NUMERIC(5,2)`, `rgb BOOLEAN`, `pack_size SMALLINT`
  - Add thermal paste columns: `weight_grams NUMERIC(6,2)`, `thermal_conductivity NUMERIC(6,2)`, `paste_type VARCHAR(20)` with CHECK constraint `('paste','liquid_metal','pad')`
  - Create `unmatched_suggestions` table with all columns from the design (id, unmatched_listing_id UNIQUE FK, category, confidence CHECK, canonical_name, brand, existing_component_id FK, specs_hint JSONB, computed_at)
  - Add indexes: `idx_unmatched_suggestions_listing`, `idx_unmatched_suggestions_confidence`, `idx_unmatched_suggestions_canonical`
  - All new columns are nullable — existing rows are unaffected
  - Run migration via `wsl -d Ubuntu -- bash -c "cd /mnt/c/Headquarters/Projects/PcBuilder/apps/backend && ~/.bun/bin/bun run src/db/migrate.ts 2>&1"` and confirm it applies cleanly
  - Run full test suite and confirm 606 tests pass
  - _Requirements: 5.1, 5.2, 6.1, 6.2, 4.1, 15.1, 15.2_

- [x] 2. Update shared types — add fan and thermal_paste to ComponentCategory
  - In `shared/types.ts`, extend `ComponentCategory` union to include `'fan'` and `'thermal_paste'`
  - Add `fan: 'Ventilateur'` and `thermal_paste: 'Pâte thermique'` to `CATEGORY_LABELS`
  - Append `'fan'` and `'thermal_paste'` to `CATEGORY_ORDER`
  - Add new optional fields to the `Component` interface: `size_mm?: number`, `airflow_cfm?: number`, `noise_db?: number`, `rgb?: boolean`, `pack_size?: number`, `weight_grams?: number`, `thermal_conductivity?: number`, `paste_type?: 'paste' | 'liquid_metal' | 'pad'`
  - Run diagnostics on `shared/types.ts` to confirm no type errors
  - Run full test suite and confirm 606 tests pass
  - _Requirements: 5.5, 6.5, 15.3_

- [x] 3. Add Zod schemas for fan and thermal_paste
  - In `apps/backend/src/schemas/componentSchemas.ts`, add `fanSchema` extending `baseSchema` with: `size_mm: z.number().int()` (required), `airflow_cfm`, `noise_db`, `rgb`, `pack_size` as optional; add `.refine()` that rejects `size_mm` not in `[80, 92, 120, 140, 200]` with a descriptive HTTP 400 message
  - Add `thermalPasteSchema` extending `baseSchema` with: `weight_grams: z.number()` (required), `thermal_conductivity`, `paste_type: z.enum(['paste','liquid_metal','pad'])` as optional
  - Add both schemas to the `componentSchemas` map
  - Extend the `ComponentInput` union type with the two new category shapes
  - Run diagnostics on `componentSchemas.ts` to confirm no type errors
  - Run full test suite and confirm 606 tests pass
  - _Requirements: 5.3, 5.4, 6.3, 6.4, 15.3_

- [x] 4. Implement the Suggestion Engine — pure function module
  - Create `apps/backend/src/services/suggestionEngine.ts`
  - Export the `Suggestion` interface as defined in the design
  - Implement `deriveCanonicalName(scrapedName: string, brand: string | null): string` — strips color tokens (Noir, Blanc, Black, White, Blanche, Noire, Rouge, Red, Blue, Bleu, Silver, Argent, Gold, Or), noise tokens (Kit, Bundle, Pack, Combo, OEM, Retail, Box, Edition, Version), and the detected brand; normalizes whitespace; falls back to original name minus brand if result is empty
  - Implement `extractBrandFromName(scrapedName: string): string | null` — checks against the known brand list from Requirement 1.6
  - Implement the keyword scorer using the `KEYWORD_SETS` from the design (10 categories including fan and thermal_paste)
  - Implement `suggestForListing(scrapedName: string, catalog: CatalogComponent[]): Suggestion` — Step 1: derive canonical name; Step 2: DNA match via `findBestMatch` at PERFECT_THRESHOLD → `confidence: "high"`; Step 3: DNA match at PARTIAL_THRESHOLD → `confidence: "medium"`; Step 4: keyword scorer fallback; Step 5: populate `specs_hint` from category
  - Implement `processBatch(listings: Array<{id: number; scraped_name: string}>, catalog: CatalogComponent[]): Map<number, Suggestion>` — calls `suggestForListing` for each listing, returns a Map keyed by listing id
  - No DB access anywhere in this file — pure functions only
  - Run diagnostics on `suggestionEngine.ts`
  - Run full test suite and confirm 606 tests pass
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [x] 5. Property-based tests for the Suggestion Engine
  - [x] 5.1 Write property test for canonical name idempotency
    - Create `apps/backend/src/services/__tests__/suggestionEngine.pbt.test.ts`
    - Use `fast-check` (already in project) with `fc.string()`
    - **Property 1: Canonical name is idempotent** — `deriveCanonicalName(deriveCanonicalName(x, null), null) === deriveCanonicalName(x, null)` for any string x
    - **Validates: Requirements 3.4, 3.7**

  - [x] 5.2 Write property test for color variant collapse
    - In the same file
    - **Property 2: Color variants collapse** — for any base name N and any color token C in the strip list, `deriveCanonicalName(N + " " + C, null) === deriveCanonicalName(N, null)`
    - Use `fc.constantFrom(...COLOR_TOKENS)` for the color token
    - **Validates: Requirements 3.1, 3.5**

  - [x] 5.3 Write property test for suggestion engine purity
    - In the same file
    - **Property 3: Suggestion engine is pure** — calling `suggestForListing(name, catalog)` twice with the same inputs returns identical results (same confidence, same canonical_name, same category)
    - Use a fixed small catalog snapshot for the property
    - **Validates: Requirements 1.7, 3.7**

  - [x] 5.4 Write property test for batch consistency
    - In the same file
    - **Property 4: Batch = individual** — `processBatch([{id:1, scraped_name: name}], catalog).get(1)` produces the same result as `suggestForListing(name, catalog)` for any name
    - **Validates: Requirement 4.5**

  - Run the PBT file via `wsl -d Ubuntu -- bash -c "cd /mnt/c/Headquarters/Projects/PcBuilder/apps/backend && ~/.bun/bin/bun test src/services/__tests__/suggestionEngine.pbt.test.ts 2>&1"` and confirm all properties pass
  - Run full test suite and confirm 606 tests still pass

- [x] 6. Implement the Suggestion Preprocessor and wire into session.ts
  - Create `apps/backend/src/services/suggestionPreprocessor.ts`
  - Export `runSuggestionPreprocessing(): Promise<{ processed: number; skipped: number }>`
  - Load all active catalog components in a single query
  - Fetch all pending listings with no suggestion or suggestion older than 24h
  - Call `processBatch()` from `suggestionEngine.ts` (no per-listing DB queries)
  - Batch-upsert results into `unmatched_suggestions` using `ON CONFLICT (unmatched_listing_id) DO UPDATE SET ...`
  - Log errors per listing and continue (never abort the batch)
  - Log a summary at the end
  - In `apps/backend/scraper/session.ts`, add one line after `buildFromUnmatched()`: `await runSuggestionPreprocessing()` — import the function; do NOT change the `runScrapingSession` signature
  - Run diagnostics on both files
  - Run full test suite and confirm 606 tests pass (the session.ts change must not break the existing scraper isolation PBT)
  - _Requirements: 4.1, 4.2, 4.3, 4.5, 4.6, 4.7, 15.5_

- [x] 7. New API routes — unmatchedSuggestions router
  - Create `apps/backend/src/routes/admin/unmatchedSuggestions.ts`
  - Apply `authMiddleware` to all routes in this file
  - Implement `GET /grouped` — query `unmatched_suggestions` joined with `unmatched_listings` and `retailers`; group by `canonical_name`; return `CanonicalGroupResponse` shape from the design; listings with no suggestion row fall back to raw `scraped_name` with `confidence: "unknown"`; support `search` and `retailer_id` query params
  - Implement `POST /reprocess` — call `runSuggestionPreprocessing()` synchronously and return `{ processed, skipped }`
  - Implement `POST /bulk-dismiss` — accept `{ listing_ids: number[] }`; UPDATE `status = 'dismissed'` for all IDs that are currently `pending`; DELETE their `unmatched_suggestions` rows; return `{ dismissed, skipped }` summary; skip non-pending IDs silently
  - Implement `POST /bulk-approve` — accept `{ canonical_names: string[] }`; for each high-confidence group with an `existing_component_id`, execute in a single transaction: INSERT `scraper_mappings`, UPDATE `unmatched_listings` status, DELETE `unmatched_suggestions`; return `{ approved_groups, linked_listings, skipped_groups }`; roll back all on any error
  - Implement `POST /create-and-link` — accept `CreateAndLinkRequest` from the design; check for duplicate `canonical_name + category + brand` (return HTTP 409 if exact match found); execute in a single `sql.begin()` transaction: INSERT component, INSERT scraper_mappings, UPDATE listing statuses, DELETE suggestion rows; return `CreateAndLinkResponse`; roll back all on any error; after success, trigger `runSuggestionPreprocessing()` in the background (fire-and-forget, do not await)
  - Run diagnostics on the new file
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 9.4, 9.5, 10.1, 10.4, 10.5, 10.6, 13.1, 13.2, 13.4, 14.2, 15.4, 15.9_

- [x] 8. New API route — scraperUrls router
  - Create `apps/backend/src/routes/admin/scraperUrls.ts`
  - Apply `authMiddleware`
  - Implement `POST /scrape-urls` — accept `{ urls: Array<{ retailer_id: number; product_url: string }> }`; for each URL, find the matching scraper config by `retailer_id`; run the scraper for that specific URL using the existing scraper class (reuse without modification); after all scrapes complete, call `aggregate()` for the fetched prices; return `{ scraped: number; failed: number }`
  - Run diagnostics on the new file
  - _Requirements: 12.2, 12.3, 12.4, 12.5, 15.9_

- [x] 9. Wire new routes in app.ts
  - In `apps/backend/src/app.ts`, import `unmatchedSuggestionsRouter` from `./routes/admin/unmatchedSuggestions.js` and `scraperUrlsRouter` from `./routes/admin/scraperUrls.js`
  - Mount `unmatchedSuggestionsRouter` at `/api/admin/unmatched-listings` (alongside the existing `adminUnmatchedRouter` — Hono merges routes on the same prefix)
  - Mount `scraperUrlsRouter` at `/api/admin/scrapers`
  - Run diagnostics on `app.ts`
  - Run full test suite and confirm 606 tests pass
  - _Requirements: 15.3, 15.9_

- [x] 10. Backend tests for all new routes
  - [x] 10.1 Tests for GET /grouped
    - Create `apps/backend/src/routes/admin/__tests__/unmatchedSuggestions.test.ts`
    - Test: returns grouped listings with suggestion data when suggestions exist
    - Test: falls back to raw scraped_name with confidence "unknown" when no suggestion row exists
    - Test: search filter narrows results
    - Test: retailer_id filter narrows results
    - Test: returns 401 without auth token
    - _Requirements: 10.1, 10.4, 10.5, 10.6, 15.9_

  - [x] 10.2 Tests for POST /reprocess
    - Test: returns `{ processed, skipped }` summary
    - Test: returns 401 without auth token
    - _Requirements: 4.4, 15.9_

  - [x] 10.3 Tests for POST /bulk-dismiss
    - Test: dismisses pending listings and deletes their suggestion rows
    - Test: skips non-pending IDs and reports them in `skipped` count
    - Test: returns 401 without auth token
    - _Requirements: 9.4, 9.5, 15.9_

  - [x] 10.4 Tests for POST /bulk-approve
    - Test: links all high-confidence groups to their existing components in one transaction
    - Test: skips groups that are not high-confidence or have no existing_match
    - Test: returns 401 without auth token
    - _Requirements: 8.3, 8.4, 8.6, 15.9_

  - [x] 10.5 Tests for POST /create-and-link
    - Test: creates component and links all listing IDs atomically
    - Test: returns HTTP 409 when exact canonical_name + category + brand already exists
    - Test: rolls back on transaction failure (no partial state)
    - Test: returns 401 without auth token
    - _Requirements: 7.3, 7.4, 13.1, 13.2, 15.9_

  - [x] 10.6 Tests for POST /scrape-urls
    - Create `apps/backend/src/routes/admin/__tests__/scraperUrls.test.ts`
    - Test: accepts valid payload and returns `{ scraped, failed }` summary
    - Test: returns 401 without auth token
    - _Requirements: 12.3, 15.9_

  - Run full test suite and confirm all new tests pass and the 606 baseline is intact

- [x] 11. Checkpoint — backend complete
  - Run full test suite: `wsl -d Ubuntu -- bash -c "cd /mnt/c/Headquarters/Projects/PcBuilder/apps/backend && ~/.bun/bin/bun test 2>&1"`
  - Confirm all backend tests pass (≥ 578 backend tests)
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Admin UI — new shared components
  - [x] 12.1 Create ConfidenceBadge component
    - Create `apps/admin/src/components/ConfidenceBadge.tsx`
    - Props: `confidence: 'high' | 'medium' | 'low' | 'unknown'`, `category: string | null`
    - `high` → green filled badge style
    - `medium` → yellow outlined badge style
    - `low` / `unknown` → muted grey badge displaying "Unknown"
    - No per-row API calls — data comes from parent
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

  - [x] 12.2 Create FanSpecFields component
    - Create `apps/admin/src/components/FanSpecFields.tsx`
    - Props: `values: FanSpecValues`, `onChange: (values: FanSpecValues) => void`
    - Fields: `size_mm` (select: 80, 92, 120, 140, 200 — required), `airflow_cfm` (number, optional), `noise_db` (number, optional), `rgb` (checkbox, optional), `pack_size` (number, optional)
    - _Requirements: 5.6_

  - [x] 12.3 Create ThermalPasteSpecFields component
    - Create `apps/admin/src/components/ThermalPasteSpecFields.tsx`
    - Props: `values: ThermalPasteSpecValues`, `onChange: (values: ThermalPasteSpecValues) => void`
    - Fields: `weight_grams` (number — required), `thermal_conductivity` (number, optional), `paste_type` (select: paste, liquid_metal, pad — optional)
    - _Requirements: 6.6_

  - [x] 12.4 Create CreateAndLinkModal component
    - Create `apps/admin/src/components/CreateAndLinkModal.tsx`
    - Props: `group: CanonicalGroup | null`, `isOpen: boolean`, `onClose: () => void`, `onSuccess: (result: CreateAndLinkResult) => void`
    - Pre-fill `name`, `brand`, `category` from `group.canonical_name`, `group.brand`, `group.category`
    - Pre-fill spec fields from `group.specs_hint`
    - When `group.existing_component_id` is present, show "Link to existing" as primary CTA and "Create new" as secondary
    - When admin overrides a `high`-confidence category, show an inline confirmation step before allowing save
    - On submit, POST to `/api/admin/unmatched-listings/create-and-link`
    - On success, show a success toast with component name, linked count, and a "Fetch prices now" button that calls `POST /api/admin/scrapers/scrape-urls`
    - Render `FanSpecFields` when category is `fan`; render `ThermalPasteSpecFields` when category is `thermal_paste`
    - _Requirements: 7.1, 7.2, 7.5, 7.6, 7.7, 12.1, 14.1_

  - Run diagnostics on all four new component files
  - _Requirements: 5.6, 6.6, 7.1, 7.2, 7.5, 7.6, 7.7, 11.1–11.5, 12.1, 14.1_

- [x] 13. Admin UI — enhance Unmatched.tsx with grouped view and bulk actions
  - Add new API functions to `apps/admin/src/api.ts`: `getGroupedUnmatched`, `reprocessSuggestions`, `bulkDismissUnmatched`, `bulkApproveUnmatched`, `scrapeUrls`
  - Add the `CanonicalGroup` type to `api.ts`
  - In `Unmatched.tsx`, add a view toggle ("Grouped" / "Flat") — flat view is the existing behavior, unchanged
  - In grouped view: fetch from `GET /api/admin/unmatched-listings/grouped`; render one `<CanonicalGroupRow>` per group showing canonical name, brand, `<ConfidenceBadge>`, retailer count, price range, and a checkbox for multi-select
  - Expand a group row to show individual listing rows (retailer, exact scraped name, price, URL, date)
  - "Create & Link" button on each group row opens `<CreateAndLinkModal>` pre-filled from group data
  - "Link to existing" button appears on groups with `existing_component_id` — calls `/create-and-link` directly without opening the modal
  - "Bulk Approve" button — enabled only when ≥1 visible group has `confidence: "high"` and `existing_component_id`; shows confirmation dialog with count breakdown by category; on confirm, calls `POST /bulk-approve`; on success, refreshes queue and shows summary toast
  - "Dismiss selected" button — appears when ≥1 group is checked; shows confirmation dialog with count; on confirm, calls `POST /bulk-dismiss`; on success, removes dismissed groups and shows notification
  - On `CreateAndLinkModal` success, remove the group from the queue view and show the success toast
  - Run diagnostics on `Unmatched.tsx` and `api.ts`
  - _Requirements: 7.7, 8.1, 8.2, 8.3, 8.5, 9.1, 9.2, 9.3, 9.6, 10.1, 10.2, 10.3, 11.1–11.5, 15.4, 15.8_

- [x] 14. Admin UI — update ComponentModal to support fan and thermal_paste spec fields
  - In `apps/admin/src/components/ComponentModal.tsx`, extend `CATEGORY_FIELDS` to include entries for `fan` and `thermal_paste` (or replace with the dedicated spec field components)
  - Add `fan` and `thermal_paste` to the `FormData` type with their new fields: `size_mm`, `airflow_cfm`, `noise_db`, `rgb`, `pack_size`, `weight_grams`, `thermal_conductivity`, `paste_type`
  - Update `emptyForm()` to include defaults for the new fields
  - Update `setCategory()` to reset the new fields when category changes
  - Update the `handleSubmit` payload builder to include the new fields when category is `fan` or `thermal_paste`
  - Render `<FanSpecFields>` when `formData.category === 'fan'` and `<ThermalPasteSpecFields>` when `formData.category === 'thermal_paste'`
  - The `CATEGORY_ORDER` import from `@shared/types` now includes `fan` and `thermal_paste` — the category dropdown will automatically include them
  - Run diagnostics on `ComponentModal.tsx`
  - _Requirements: 5.6, 6.6, 15.8_

- [x] 15. Frontend tests
  - [x]* 15.1 Write unit tests for ConfidenceBadge
    - Create `apps/admin/src/components/__tests__/ConfidenceBadge.test.tsx`
    - Test: renders green style for `confidence: "high"`
    - Test: renders yellow style for `confidence: "medium"`
    - Test: renders muted style and "Unknown" text for `confidence: "low"` and `"unknown"`
    - _Requirements: 11.2, 11.3, 11.4_

  - [x]* 15.2 Write unit tests for FanSpecFields and ThermalPasteSpecFields
    - Create `apps/admin/src/components/__tests__/SpecFields.test.tsx`
    - Test: FanSpecFields renders size_mm select with correct options (80, 92, 120, 140, 200)
    - Test: ThermalPasteSpecFields renders paste_type select with correct options
    - _Requirements: 5.6, 6.6_

  - Run frontend tests: `wsl -d Ubuntu -- bash -c "cd /mnt/c/Headquarters/Projects/PcBuilder/apps/admin && ~/.bun/bin/bun test 2>&1"` and confirm ≥ 28 tests pass

- [x] 16. Final checkpoint — full test suite
  - Run backend tests: `wsl -d Ubuntu -- bash -c "cd /mnt/c/Headquarters/Projects/PcBuilder/apps/backend && ~/.bun/bin/bun test 2>&1"`
  - Run frontend tests: `wsl -d Ubuntu -- bash -c "cd /mnt/c/Headquarters/Projects/PcBuilder/apps/admin && ~/.bun/bin/bun test 2>&1"`
  - Confirm total ≥ 606 tests pass (578 backend + 28 frontend baseline, plus all new tests)
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Every task runs the full test suite before marking complete — no task is done if it introduces a regression
- The existing `GET /api/admin/unmatched-listings` flat endpoint is never touched — the grouped endpoint is purely additive
- `session.ts` receives exactly one new line — the `runSuggestionPreprocessing()` call — and its signature does not change
- The `create-and-link` transaction uses `sql.begin()` (Bun.sql transaction API) — roll back on any error, no partial state
- Property tests use `fast-check` which is already installed in the backend
- All new backend routes are mounted under `/api/admin/` and protected by `authMiddleware`
