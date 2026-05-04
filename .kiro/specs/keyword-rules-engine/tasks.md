# Implementation Plan: Keyword Rules Engine

## Overview

Implements admin-configurable keyword→category rules stored in PostgreSQL, loaded at runtime by the suggestion engine before the hardcoded sets. Also adds `fan` and `thermal_paste` auto-creation paths to `catalogBuilder.ts`, extends `inferCategory` in `shared/component-utils.ts`, and delivers a full admin UI (Token Picker, Add Rule Modal, Keyword Rules page).

The implementation follows the order specified: database first, then backend services, then routes, then frontend.

---

## Tasks

- [x] 1. Migration 024 — `keyword_rules` table + built-in seed
  - Create `apps/backend/src/db/migrations/024_keyword_rules.sql`
  - Define the `keyword_rules` table with columns: `id SERIAL PRIMARY KEY`, `keyword VARCHAR(200) NOT NULL`, `match_type VARCHAR(20) NOT NULL DEFAULT 'contains' CHECK (match_type IN ('contains','word','starts_with','number_before'))`, `category VARCHAR(50) NOT NULL CHECK (category IN ('cpu','gpu','ram','motherboard','storage','psu','case','cooling','fan','thermal_paste'))`, `source VARCHAR(10) NOT NULL CHECK (source IN ('admin','builtin'))`, `created_by INTEGER REFERENCES admins(id) ON DELETE SET NULL`, `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
  - Add `UNIQUE (keyword, category, match_type)` constraint
  - Add `CREATE INDEX idx_keyword_rules_source ON keyword_rules (source)` and `CREATE INDEX idx_keyword_rules_keyword ON keyword_rules (keyword)`
  - Seed one row per keyword from `KEYWORD_SETS` in `suggestionEngine.ts` with `source='builtin'`, `created_by=NULL`, using `ON CONFLICT (keyword, category, match_type) DO NOTHING` for idempotency — all ten categories must be covered
  - Do NOT modify any existing migration file (001–023)
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3_

- [x] 2. `keywordRulesService.ts` — `matchesRule` pure function + `loadAdminRules`
  - Create `apps/backend/src/services/keywordRulesService.ts`
  - Export the `KeywordRule` interface: `{ id, keyword, match_type, category, source, created_by, created_at }`
  - Implement `escapeRegex(s: string): string` — escapes all special regex characters before constructing patterns
  - Implement `matchesRule(rule: Pick<KeywordRule, 'keyword' | 'match_type'>, name: string): boolean` as a pure function with a try/catch that returns `false` on regex errors; implement all four match types exactly as specified in the design (`contains`, `word`, `starts_with`, `number_before`)
  - Implement `loadAdminRules(): Promise<KeywordRule[]>` — `SELECT * FROM keyword_rules WHERE source='admin' ORDER BY created_at DESC`; if the query fails, propagate the error (do not swallow it)
  - _Requirements: 1.1, 1.2, 1.3, 7.1, 7.7_

  - [ ]* 2.1 Write property tests for `matchesRule` (Properties 3 and 5 from design)
    - Create `apps/backend/src/services/__tests__/keywordRulesService.pbt.test.ts`
    - **Property 3: `number_before` match type correctness** — for any alphabetic keyword K and positive integer N, `matchesRule({ keyword: K, match_type: 'number_before' }, String(N) + K)` returns `true` AND `matchesRule({ keyword: K, match_type: 'number_before' }, K)` returns `false`
    - **Property 5: Token classification correctness** — for any token T: if T is in `COLOR_TOKENS` or `NOISE_TOKENS` or has `length <= 1`, `classifyToken(T)` returns `'noise'`; otherwise returns `'meaningful'` (export `classifyToken` from `TokenPicker.tsx` or a shared util for this test)
    - Use `fast-check` (add as dev dependency if not present: `bun add -d fast-check`)
    - Minimum 100 iterations per property
    - Annotate each test with `// Feature: keyword-rules-engine, Property N: ...`
    - _Requirements: 1.1, 1.2, 10.2_

- [x] 3. Update `suggestionEngine.ts` — add optional `adminRules` param
  - Add `import { matchesRule, type KeywordRule } from './keywordRulesService.js'` at the top
  - Extend `suggestForListing` signature to `suggestForListing(scrapedName: string, catalog: CatalogComponent[], adminRules?: KeywordRule[]): Suggestion` — the third parameter is optional so all existing call sites remain valid without changes
  - Insert the admin rules check between the partial DNA match step (step 3) and the hardcoded keyword scorer (step 4): iterate `adminRules`, call `matchesRule` for each, collect matching rules; if all matching rules agree on a single category, return that category with `confidence: 'medium'`; if they disagree, fall through to the keyword scorer
  - Extend `processBatch` signature to `processBatch(listings, catalog, adminRules?: KeywordRule[]): Map<number, Suggestion>` and pass `adminRules` through to each `suggestForListing` call
  - Do NOT change the behavior when `adminRules` is `undefined` or `[]` — the hardcoded keyword scorer must remain the fallback
  - _Requirements: 7.2, 7.3, 7.4, 7.5, 7.6, 19.1, 19.2, 19.3, 19.4, 20.5_

- [x] 4. Update `suggestionPreprocessor.ts` — load admin rules once per batch
  - Add `import { loadAdminRules } from './keywordRulesService.js'` at the top
  - In `runSuggestionPreprocessing`, after loading the catalog (Step 1) and before fetching pending listings (Step 2), add: `const adminRules = await loadAdminRules();` — wrap in try/catch; on failure, log the error and return `{ processed: 0, skipped: pending.length }` without partially processing the batch
  - Pass `adminRules` to `processBatch(pending, catalog, adminRules)`
  - _Requirements: 7.1, 7.7_

- [x] 5. Update `shared/component-utils.ts` — add `extractFanSpecs`, `extractThermalPasteSpecs`, update `inferCategory`
  - [x] 5.1 Add `extractFanSpecs(name: string): { size_mm: number; rgb: boolean; pack_size: number }` after the existing `extractCoolingSpecs` function
    - `size_mm`: match `/\b(80|92|120|140|200)\s*mm\b/i`, default `120`
    - `rgb`: `/\b(rgb|argb)\b/i` test
    - `pack_size`: triple/3-pack/3x → 3, dual/twin/2-pack/2x → 2, else 1
    - _Requirements: 15.1, 15.3, 15.4_
  - [x] 5.2 Add `extractThermalPasteSpecs(name: string): { weight_grams: number | null; paste_type: 'paste' | 'liquid_metal' | 'pad' }` after `extractFanSpecs`
    - `weight_grams`: match `/\b(\d+(?:\.\d+)?)\s*(?:grammes?|g)\b/i`, null if not found
    - `paste_type`: `conductonaut`/`liquid metal` → `'liquid_metal'`; `carbonaut`/`kryosheet`/`pad` → `'pad'`; default `'paste'`
    - _Requirements: 16.1, 16.3, 16.4_
  - [x] 5.3 Update `inferCategory` to return `'fan'` and `'thermal_paste'`
    - Add fan detection AFTER the cooling check (so cooling takes precedence): if name matches fan pattern (contains `fan` or `ventilateur` without cooler/AIO context, OR contains `120mm`/`140mm`/`200mm` in a standalone fan context), return `'fan'`
    - Add thermal paste detection BEFORE the final `return null`: if name matches thermal paste pattern (contains `thermal paste`, `pâte thermique`, `kryonaut`, `conductonaut`, `mx-4`, `mx-6`, `mx-7`, `carbonaut`, or `kryosheet`), return `'thermal_paste'`
    - The existing cooling check must remain unchanged — names that currently return `'cooling'` must still return `'cooling'`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ]* 5.4 Write property tests for `inferCategory` non-regression (Property 7) and `decodeHtml` idempotence (Property 8)
    - Create `apps/backend/src/services/__tests__/componentUtils.pbt.test.ts`
    - **Property 7: `inferCategory` fan/thermal_paste does not regress existing categories** — use a fixed corpus of known product names with expected categories (at minimum: one CPU, one GPU, one RAM, one motherboard, one storage, one PSU, one cooling AIO, one cooling air, one case); for each, assert `inferCategory(name) === expectedCategory`
    - **Property 8: `decodeHtml` idempotence** — for any string S, `decodeHtml(decodeHtml(S)) === decodeHtml(S)`; for any string S with no HTML entity patterns, `decodeHtml(S) === S`
    - Use `fast-check` for Property 8; use `fc.constantFrom` over the corpus for Property 7
    - Annotate each test with `// Feature: keyword-rules-engine, Property N: ...`
    - _Requirements: 3.3, 4.4, 20.9_

- [x] 6. Update `catalogBuilder.ts` — add `fan` and `thermal_paste` creation paths
  - Add `extractFanSpecs, extractThermalPasteSpecs` to the import from `@shared/component-utils`
  - Add `fan` branch in the category switch after the `case` branch:
    ```typescript
    } else if (category === 'fan') {
      const specs = extractFanSpecs(scrapedName);
      const rows = await sql`
        INSERT INTO components (slug, name, brand, category, size_mm, rgb, pack_size, is_active)
        VALUES (${slug}, ${cleanedName}, ${brand}, 'fan', ${specs.size_mm}, ${specs.rgb}, ${specs.pack_size}, true)
        RETURNING id
      ` as { id: number }[];
      newId = rows[0]?.id;
    }
    ```
  - Add `thermal_paste` branch immediately after:
    ```typescript
    } else if (category === 'thermal_paste') {
      const specs = extractThermalPasteSpecs(scrapedName);
      const rows = await sql`
        INSERT INTO components (slug, name, brand, category, weight_grams, paste_type, is_active)
        VALUES (${slug}, ${cleanedName}, ${brand}, 'thermal_paste', ${specs.weight_grams}, ${specs.paste_type}, true)
        RETURNING id
      ` as { id: number }[];
      newId = rows[0]?.id;
    }
    ```
  - The `buildFromUnmatched` function signature `(onProgress?: (done: number, total: number) => void): Promise<BuildResult>` must NOT change
  - Both new branches must follow the same DNA dedup check, scraper_mappings insert, and `status = 'linked'` update as all other categories
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 15.1, 15.2, 15.5, 16.1, 16.2, 16.5_

  - [ ]* 6.1 Write unit tests for `catalogBuilder` fan and thermal_paste paths
    - Add to `apps/backend/scraper/__tests__/catalogBuilder.test.ts`
    - Test: `buildFromUnmatched` with a fan listing creates a component with `category='fan'`, `size_mm`, `rgb`, `pack_size` populated
    - Test: `buildFromUnmatched` with a thermal paste listing creates a component with `category='thermal_paste'`, `weight_grams`, `paste_type` populated
    - Test: `buildFromUnmatched` with an HTML entity in the name inserts a clean component name (no `&#8211;` etc.)
    - _Requirements: 2.1, 2.2, 4.1, 4.2, 15.1, 16.1_

- [x] 7. Checkpoint — run full backend test suite
  - Run: `wsl -d Ubuntu -- bash -c "cd /mnt/c/Headquarters/Projects/PcBuilder/apps/backend && ~/.bun/bin/bun test 2>&1"`
  - All 655+ existing tests must pass; no regressions from tasks 1–6
  - Fix any failures before proceeding to task 8
  - _Requirements: 20.6_

- [x] 8. `keywordRulesRouter.ts` — GET, POST, DELETE, POST /preview endpoints
  - Create `apps/backend/src/routes/admin/keywordRulesRouter.ts`
  - Mount `authMiddleware` on `/*` using the existing pattern from other admin routers
  - Import `matchesRule, loadAdminRules, type KeywordRule` from `keywordRulesService.js`
  - Import `runSuggestionPreprocessing` from `suggestionPreprocessor.js` for fire-and-forget after mutations
  - **`GET /`** — query all rules with `match_count` using a single SQL lateral subquery (ILIKE `'%' || keyword || '%'`); return array sorted by `source ASC, created_at DESC`; include all fields from `KeywordRuleResponse` interface
  - **`POST /`** — validate `keyword` (non-empty, ≤200 chars → 400 `INVALID_KEYWORD`), `match_type` (one of four values → 400 `INVALID_MATCH_TYPE`), `category` (one of ten values → 400 `INVALID_CATEGORY`); insert with `source='admin'`, `created_by` from `c.get('admin').id`; on unique constraint violation return 409 `DUPLICATE_RULE`; on success return 201 with the created row; fire-and-forget `runSuggestionPreprocessing()`
  - **`DELETE /:id`** — parse id (400 if not integer); fetch rule; 404 if not found; 403 `CANNOT_DELETE_BUILTIN` if `source='builtin'`; delete and return 200; fire-and-forget `runSuggestionPreprocessing()`
  - **`POST /preview`** — validate `keyword` and `match_type`; fetch all pending unmatched listings; apply `matchesRule` to each; return `{ match_count, sample_names }` (up to 5 sample names); this endpoint uses the full `matchesRule` logic (not ILIKE) for accuracy
  - All error responses follow `{ error: { code, message } }` format
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 8.10, 8.11, 9.1, 9.2, 9.3, 9.4, 17.1, 18.1, 18.2_

- [x] 9. Wire `keywordRulesRouter` in `app.ts`
  - Add `import { keywordRulesRouter } from './routes/admin/keywordRulesRouter.js'` to `apps/backend/src/app.ts`
  - Add `app.route('/api/admin/keyword-rules', keywordRulesRouter)` in the protected routes section, after the existing admin routes
  - Do NOT modify any existing route registration
  - _Requirements: 8.10, 20.3_

  - [x]* 9.1 Write integration tests for `keywordRulesRouter`
    - Create `apps/backend/src/routes/admin/__tests__/keywordRules.test.ts`
    - Use the same mock-SQL pattern as `unmatched.test.ts` (setSql/resetSql, makeApp, makeToken)
    - Test `GET /` returns 401 without token
    - Test `GET /` returns array with `match_count` field
    - Test `POST /` returns 201 with created rule
    - Test `POST /` returns 409 on duplicate (simulate unique constraint error from mock SQL)
    - Test `POST /` returns 400 `INVALID_CATEGORY` for unknown category
    - Test `POST /` returns 400 `INVALID_KEYWORD` for empty keyword
    - Test `POST /` returns 400 `INVALID_MATCH_TYPE` for unknown match_type
    - Test `DELETE /:id` returns 200 for admin rule
    - Test `DELETE /:id` returns 403 `CANNOT_DELETE_BUILTIN` for builtin rule
    - Test `DELETE /:id` returns 404 for non-existent id
    - Test `POST /preview` returns `{ match_count, sample_names }`
    - _Requirements: 8.1–8.11_

- [x] 10. Backend checkpoint — run full 655+ test suite
  - Run: `wsl -d Ubuntu -- bash -c "cd /mnt/c/Headquarters/Projects/PcBuilder/apps/backend && ~/.bun/bin/bun test 2>&1"`
  - All 655+ existing tests plus all new tests must pass
  - Fix any failures before proceeding to frontend tasks
  - _Requirements: 20.6_

- [x] 11. Frontend: `api.ts` additions — keyword rules API functions
  - Add `KeywordRule` and `KeywordRuleResponse` and `PreviewResponse` interfaces to `apps/admin/src/api.ts`
  - Add `getKeywordRules(): Promise<KeywordRuleResponse[]>` — `GET /admin/keyword-rules`
  - Add `createKeywordRule(data: { keyword: string; match_type: string; category: string }): Promise<KeywordRuleResponse>` — `POST /admin/keyword-rules`
  - Add `deleteKeywordRule(id: number): Promise<{ success: boolean }>` — `DELETE /admin/keyword-rules/:id`
  - Add `previewKeywordRule(data: { keyword: string; match_type: string }): Promise<PreviewResponse>` — `POST /admin/keyword-rules/preview`
  - All four functions use the existing `request()` wrapper (auth-aware, 401 auto-refresh)
  - _Requirements: 8.1, 8.2, 8.7, 8.9_

- [ ] 12. Frontend: `TokenPicker.tsx` component
  - Create `apps/admin/src/components/TokenPicker.tsx`
  - Export `classifyToken(token: string): 'noise' | 'meaningful'` — uses the same `COLOR_TOKENS` + `NOISE_TOKENS` lists as `deriveCanonicalName` in `suggestionEngine.ts`; tokens with `length <= 1` are noise
  - Render the scraped name split on whitespace as a row of chips
  - Noise chips: greyed-out, `cursor: default`, reduced opacity, non-interactive
  - Meaningful chips: blue (`var(--accent-blue)`), `cursor: pointer`, clickable
  - Clicking a meaningful chip opens an inline panel below it (only one panel open at a time — clicking a second chip closes the first)
  - Inline panel contains: token text (read-only display), match type radio buttons with plain-language labels ("Exact word" = `word`, "Anywhere in name" = `contains`, "Name starts with" = `starts_with`, "Number before" = `number_before`), category dropdown using `CATEGORY_ORDER` + `CATEGORY_LABELS`, "Preview" button, "Save rule" button (disabled until preview has been run successfully)
  - On "Preview" click: call `previewKeywordRule`, display "This rule would affect X pending items" with up to 3 sample names inline; on error display inline error without closing panel
  - On "Save rule" click: call `createKeywordRule`; on success close panel and call optional `onRuleSaved` prop; on 409 display "A rule for this keyword + match type + category already exists" inline
  - Props: `{ scrapedName: string; onRuleSaved?: () => void }`
  - Chips with an existing admin rule for any category display a small dot indicator (fetch existing rules on mount or accept `existingRuleKeywords?: Set<string>` prop)
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 11.1, 11.2, 11.3, 11.4, 11.5, 11.7, 11.8, 11.9_

- [x] 13. Frontend: `AddRuleModal.tsx` component
  - Create `apps/admin/src/components/AddRuleModal.tsx`
  - A standalone modal (uses existing `Modal` component) for creating rules from the Keyword Rules page
  - Contains: keyword text input (trimmed before submission), match type radio buttons (same plain-language labels as TokenPicker), category dropdown (all ten categories via `CATEGORY_ORDER` + `CATEGORY_LABELS`), "Preview" button, "Save" button
  - "Save" button disabled until keyword + match_type + category are all filled AND a successful preview has been run
  - On "Preview": call `previewKeywordRule`, display "This rule would affect X pending items" with up to 5 sample names
  - On "Save": call `createKeywordRule`; on success call `onSuccess(newRule)` and close; on 409 display duplicate error inline without closing; on 400 display server validation message
  - Props: `{ isOpen: boolean; onClose: () => void; onSuccess: (rule: KeywordRuleResponse) => void }`
  - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 14.8_

- [x] 14. Frontend: `KeywordRules.tsx` page + `KeywordRules.module.css`
  - Create `apps/admin/src/pages/KeywordRules.tsx` and `apps/admin/src/pages/KeywordRules.module.css`
  - On mount: call `getKeywordRules()` and store results; compute admin count and builtin count for the subtitle
  - Page title: "Keyword Rules"; subtitle: "X admin rules · Y built-in rules"
  - "Add rule" button opens `AddRuleModal`; on modal success append new rule to the table
  - Table columns: Keyword, Match Type, Category (using `CATEGORY_LABELS`), Source (badge: "Admin" or "Built-in"), Items Affected (`match_count`), Date Added, Actions
  - Built-in rules: "Built-in" badge (read-only style), no delete button
  - Admin rules: "Admin" badge, delete button that shows `ConfirmDialog` before calling `deleteKeywordRule`; on success remove from table and show success toast
  - Search/filter bar: client-side filter by keyword substring (text input) and by category (dropdown); default sort: admin rules first, then by `created_at` descending
  - On delete failure: display toast error
  - _Requirements: 12.1, 12.5, 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7_

- [x] 15. Frontend: Update `App.tsx` (add route) + `Layout.tsx` (add nav link)
  - In `apps/admin/src/App.tsx`: add lazy import `const KeywordRules = lazy(() => import('./pages/KeywordRules').then(m => ({ default: m.KeywordRules })))` and add `<Route path="keyword-rules" element={<KeywordRules />} />` inside the protected `<Route path="/admin">` block
  - In `apps/admin/src/components/Layout.tsx`: add `{ to: '/admin/keyword-rules', label: 'Keyword Rules', icon: Tag }` to the `NAV` array (import `Tag` from `lucide-react`); place it after the "Non associes" entry
  - _Requirements: 12.1, 12.2, 12.3, 12.4_

- [x] 16. Frontend: Update `CreateAndLinkModal.tsx` to include `TokenPicker`
  - Import `TokenPicker` from `./TokenPicker`
  - Fetch existing keyword rules once when the modal opens (call `getKeywordRules()`) and derive `existingRuleKeywords` as a `Set<string>` of all rule keywords
  - Render `<TokenPicker scrapedName={group.listings[0].scraped_name} existingRuleKeywords={existingRuleKeywords} onRuleSaved={handleRuleSaved} />` above the form fields, only when `group.confidence !== 'high'`
  - Implement `handleRuleSaved`: re-fetch the suggestion for the current group by calling `reprocessSuggestions()` (already in `api.ts`), then update the displayed category badge and pre-filled form fields from the refreshed group data
  - Do NOT change the existing form fields, submit logic, or success/error handling
  - _Requirements: 10.1, 10.5, 11.6_

- [x] 17. Final checkpoint — run full backend test suite
  - Run: `wsl -d Ubuntu -- bash -c "cd /mnt/c/Headquarters/Projects/PcBuilder/apps/backend && ~/.bun/bin/bun test 2>&1"`
  - All 655+ existing tests plus all new tests must pass
  - Confirm no regressions across all tasks
  - _Requirements: 20.6_

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- The `buildFromUnmatched` signature must not change — existing callers are unaffected
- The `suggestForListing` and `processBatch` signatures gain an optional third parameter — all existing call sites remain valid without modification
- Migration 024 must be the only new migration file; never edit 001–023
- All new backend endpoints use the existing `authMiddleware` pattern
- Property tests use `fast-check`; add it as a dev dependency if not already present
- The `classifyToken` function in `TokenPicker.tsx` must use the same token lists as `deriveCanonicalName` in `suggestionEngine.ts` — keep them in sync
- Fire-and-forget `runSuggestionPreprocessing()` after POST/DELETE on keyword rules: call without `await` and ignore the returned promise
