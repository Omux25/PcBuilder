# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Codebase Defects Exist
  - **CRITICAL**: This test MUST FAIL on unfixed code — failure confirms the bugs exist
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior — it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bugs exist
  - **Scoped PBT Approach**: For deterministic bugs, scope the property to the concrete failing cases to ensure reproducibility
  - Create `backend/src/__tests__/bugCondition.test.ts` with the following checks:
    - Assert `SCRAPER_REGISTRY.find(s => s.id === 10)` returns `undefined` (UltraPC is registered as id:1, not 10)
    - Assert `RULE_LABELS['form_factor_mismatch']` is `undefined` (missing entry)
    - Assert `RULE_LABELS['cooler_too_tall']` is `undefined` (missing entry)
    - Assert `RULE_TOOLTIPS['form_factor_mismatch']` is `undefined` (missing entry)
    - Assert `RULE_TOOLTIPS['cooler_too_tall']` is `undefined` (missing entry)
    - Assert migration filenames in `backend/src/db/migrations/` contain two files starting with `015_` (duplicate prefix)
    - Assert `backend/src/routes/admin/logs.ts` source text contains `import { sql } from 'bun'` (DI bypass)
    - Assert `backend/src/routes/admin/unmatched.ts` source text contains `import { sql } from 'bun'` (DI bypass)
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct — it proves the bugs exist)
  - Document counterexamples found to understand root cause
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.3, 1.4, 1.5, 1.11_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Non-Buggy Behaviors Are Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs (all mounted routes, existing rule labels, passing tests)
  - Create `backend/src/__tests__/preservation.test.ts` with the following checks:
    - Assert `RULE_LABELS['socket_mismatch']` equals `'Incompatibilité de socket'` (existing label preserved)
    - Assert `RULE_LABELS['ram_type_mismatch']` equals `'Type de RAM incompatible'` (existing label preserved)
    - Assert `RULE_LABELS['ram_frequency_exceeded']` equals `'Fréquence RAM dépassée'` (existing label preserved)
    - Assert `RULE_LABELS['gpu_too_long']` equals `'GPU trop long pour le boîtier'` (existing label preserved)
    - Assert `RULE_LABELS['psu_underpowered']` equals `'Alimentation insuffisante'` (existing label preserved)
    - Assert `SCRAPER_REGISTRY.find(s => s.id === 101)` returns the Site1 entry (placeholder IDs unchanged)
    - Assert `SCRAPER_REGISTRY.find(s => s.id === 102)` returns the Site2 entry (placeholder IDs unchanged)
    - Assert migration file `015_add_benchmark_score.sql` exists (original 015 preserved)
    - Assert migration files 001–014 all exist (no regressions in migration sequence)
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.8, 3.9, 3.10_

- [x] 3. Delete dead route files (Issues 1 & 2)

  - [x] 3.1 Delete `backend/src/routes/smartSearch.ts`
    - Delete the file — it exports `smartSearchRouter` which is never imported in `app.ts`
    - The canonical smart search implementation lives in `components.ts` at `POST /api/components/smart-search`
    - _Bug_Condition: file exports a router AND that router is NOT imported in app.ts_
    - _Expected_Behavior: file does not exist in the repository_
    - _Preservation: POST /api/components/smart-search continues to work via components.ts_
    - _Requirements: 2.1_

  - [x] 3.2 Delete `backend/src/routes/prices.ts`
    - Delete the file — it exports `pricesRouter` which is never imported in `app.ts`
    - The canonical prices implementation lives in `components.ts` at `GET /api/components/:id/prices`
    - _Bug_Condition: file exports a router AND that router is NOT imported in app.ts_
    - _Expected_Behavior: file does not exist in the repository_
    - _Preservation: GET /api/components/:id/prices continues to work via components.ts_
    - _Requirements: 2.2_

  - [x] 3.3 Delete `backend/src/routes/__tests__/prices.test.ts`
    - Delete the test file — it tests the dead prices route which no longer exists
    - _Requirements: 2.2_

  - [x] 3.4 Verify `app.ts` has no references to deleted files
    - Confirm `app.ts` contains no import of `smartSearchRouter` or `pricesRouter`
    - Run diagnostics on `backend/src/app.ts` to confirm no TypeScript errors
    - _Requirements: 2.1, 2.2_

  - [x] 3.5 Run tests to confirm nothing breaks
    - Run `bun test` in `backend/` via WSL2
    - **Property 1: Expected Behavior** — dead route files are gone, all other routes still pass
    - **Property 2: Preservation** — run preservation tests to confirm no regressions
    - _Requirements: 3.1, 3.2_

- [x] 4. Fix duplicate migration 015 and delete temp_migrate.ts (Issues 3 & 6)

  - [x] 4.1 Rename `015_fix_ram_types_encoding.sql` → `016_fix_ram_types_encoding.sql`
    - Rename `backend/src/db/migrations/015_fix_ram_types_encoding.sql` to `016_fix_ram_types_encoding.sql`
    - No SQL content changes — only the filename prefix changes
    - _Bug_Condition: two migration files share the numeric prefix 015_
    - _Expected_Behavior: all migration filenames have unique numeric prefixes_
    - _Requirements: 2.3_

  - [x] 4.2 Rename `016_add_trigram_index.sql` → `017_add_trigram_index.sql`
    - Rename `backend/src/db/migrations/016_add_trigram_index.sql` to `017_add_trigram_index.sql`
    - No SQL content changes
    - _Requirements: 2.3_

  - [x] 4.3 Rename `017_hash_refresh_tokens.sql` → `018_hash_refresh_tokens.sql`
    - Rename `backend/src/db/migrations/017_hash_refresh_tokens.sql` to `018_hash_refresh_tokens.sql`
    - No SQL content changes
    - _Requirements: 2.3_

  - [x] 4.4 Delete `backend/src/db/temp_migrate.ts`
    - Delete the file — it is a one-off throwaway script with hardcoded credentials (`postgres:postgres@127.0.0.1:5433`)
    - It references the old migration filename and has no place in the production source tree
    - _Bug_Condition: artifact IS backend/src/db/temp_migrate.ts_
    - _Expected_Behavior: file does not exist in the repository_
    - _Requirements: 2.6_

  - [x] 4.5 Verify migration files are uniquely numbered 001–018
    - List all files in `backend/src/db/migrations/` and confirm:
      - `015_add_benchmark_score.sql` still exists (original 015 preserved)
      - `016_fix_ram_types_encoding.sql` exists (renamed from 015)
      - `017_add_trigram_index.sql` exists (renamed from 016)
      - `018_hash_refresh_tokens.sql` exists (renamed from 017)
      - No two files share the same numeric prefix
    - _Requirements: 2.3, 3.9_

- [x] 5. Fix DI bypass in admin/logs.ts and admin/unmatched.ts (Issue 4)

  - [x] 5.1 Fix DI bypass in `backend/src/routes/admin/logs.ts`
    - Replace `import { sql } from 'bun'` with `import { getSql } from '../../db/index.js'`
    - Add `const sql = getSql()` at the top of the GET `/` route handler body (before the first `sql\`` call)
    - All `sql\`` template literal calls remain syntactically identical — only the source of `sql` changes
    - _Bug_Condition: file contains "import { sql } from 'bun'" AND file is a route handler_
    - _Expected_Behavior: file uses getSql() from db/index.ts for all SQL calls_
    - _Preservation: GET /api/admin/logs continues to return scraper logs with correct filtering_
    - _Requirements: 2.4, 3.6_

  - [x] 5.2 Fix DI bypass in `backend/src/routes/admin/unmatched.ts`
    - Replace `import { sql } from 'bun'` with `import { getSql } from '../../db/index.js'`
    - Add `const sql = getSql()` at the top of each route handler that uses sql:
      - GET `/` handler (unmatched listings query)
      - POST `/:id/link` handler (multiple sql calls — add once at top of handler)
      - POST `/:id/dismiss` handler (update query)
    - All `sql\`` template literal calls remain syntactically identical
    - _Bug_Condition: file contains "import { sql } from 'bun'" AND file is a route handler_
    - _Expected_Behavior: file uses getSql() from db/index.ts for all SQL calls_
    - _Preservation: GET /api/admin/unmatched-listings continues to return unmatched listings_
    - _Requirements: 2.4, 3.5_

  - [x] 5.3 Run diagnostics on both files
    - Run diagnostics on `backend/src/routes/admin/logs.ts`
    - Run diagnostics on `backend/src/routes/admin/unmatched.ts`
    - Confirm no TypeScript errors in either file
    - _Requirements: 2.4_

  - [x] 5.4 Run tests
    - Run `bun test` in `backend/` via WSL2
    - **Property 1: Expected Behavior** — DI bypass is gone, getSql() is used
    - **Property 2: Preservation** — admin logs and unmatched routes still pass their tests
    - _Requirements: 3.5, 3.6_

- [x] 6. Fix scraper registry IDs (Issue 5)

  - [x] 6.1 Update SCRAPER_REGISTRY IDs in `backend/scraper/session.ts`
    - Change UltraPC id from `1` → `10`
    - Change NextLevel id from `2` → `11`
    - Change SetupGame id from `3` → `13`
    - Leave Site1 (id: 101) and Site2 (id: 102) unchanged — these are placeholder IDs
    - Only the `id` values change — all other fields (name, instance, method) are unchanged
    - _Bug_Condition: entry.id does NOT match the actual retailer.id in the database for UltraPC/NextLevel/SetupGame_
    - _Expected_Behavior: SCRAPER_REGISTRY.find(s => s.id === 10) returns the UltraPC entry_
    - _Preservation: POST /api/admin/scrapers/run-all continues to trigger all scrapers_
    - _Requirements: 2.5, 3.3, 3.4_

  - [x] 6.2 Run diagnostics on `backend/scraper/session.ts`
    - Confirm no TypeScript errors after the ID changes
    - _Requirements: 2.5_

  - [x] 6.3 Run tests
    - Run `bun test` in `backend/` via WSL2
    - **Property 1: Expected Behavior** — SCRAPER_REGISTRY IDs match database retailer IDs
    - **Property 2: Preservation** — scraper session tests still pass, run-all behavior unchanged
    - _Requirements: 3.3, 3.4_

- [x] 7. Remove broken transaction wrapper in bulk import (Issue 10)

  - [x] 7.1 Remove `sql.begin()` wrapper from `backend/src/routes/admin/components.ts`
    - Remove the `const sql = (await import('../../db/index.js')).getSql()` line at the top of the import handler
    - Remove the `await sql.begin(async (_tx: SqlFn) => { ... })` wrapper — un-nest the inner for loop
    - Remove the outer `try/catch` that catches catastrophic transaction failure (the one that returns `INTERNAL_ERROR`)
    - Keep the inner per-row `try/catch` loop intact and at the same indentation level
    - Remove `import type { SqlFn } from '../../db/index.js'` since `SqlFn` is only used as the `_tx` parameter type
    - The result: the for loop runs directly in the handler body, with per-row error handling unchanged
    - _Bug_Condition: sql.begin() callback calls createComponent() which calls getSql() (global, not tx) — _tx is never used_
    - _Expected_Behavior: import loop runs row-by-row with honest per-row error handling, no false atomicity_
    - _Preservation: POST /api/admin/components/import with a clean file imports all rows successfully_
    - _Requirements: 2.10, 3.7_

  - [x] 7.2 Run diagnostics on `backend/src/routes/admin/components.ts`
    - Confirm no TypeScript errors after removing the transaction wrapper and SqlFn import
    - _Requirements: 2.10_

  - [x] 7.3 Run tests
    - Run `bun test` in `backend/` via WSL2
    - **Property 1: Expected Behavior** — broken transaction wrapper is gone, import handler works correctly
    - **Property 2: Preservation** — clean-file import still imports all rows, counts are correct
    - _Requirements: 3.7_

- [x] 8. Add missing RULE_LABELS and RULE_TOOLTIPS (Issue 11)

  - [x] 8.1 Add missing entries to `frontend/src/types.ts`
    - Add to `RULE_LABELS`:
      - `form_factor_mismatch: 'Format de carte mère incompatible'`
      - `cooler_too_tall: 'Refroidissement trop haut pour le boîtier'`
    - Add to `RULE_TOOLTIPS`:
      - `form_factor_mismatch: 'La carte mère ne rentre pas dans ce boîtier. Vérifiez les formats supportés (ATX, mATX, ITX).'`
      - `cooler_too_tall: 'Le ventirad CPU est trop haut pour ce boîtier. Vérifiez la hauteur maximale supportée.'`
    - Append the new entries after the existing entries in each map — do not reorder existing entries
    - _Bug_Condition: RULE_LABELS and RULE_TOOLTIPS do not contain entries for 'form_factor_mismatch' or 'cooler_too_tall'_
    - _Expected_Behavior: RULE_LABELS['form_factor_mismatch'] and RULE_LABELS['cooler_too_tall'] are defined strings_
    - _Preservation: all 5 existing RULE_LABELS and RULE_TOOLTIPS entries remain unchanged_
    - _Requirements: 2.11, 3.8_

  - [x] 8.2 Run diagnostics on `frontend/src/types.ts`
    - Confirm no TypeScript errors after adding the new entries
    - _Requirements: 2.11_

- [x] 9. Clean up stale root-level artifacts (Issues 7 & 8)

  - [x] 9.1 Delete `GEMINI.md` from project root
    - Delete the file — it is a stale configuration file for the Gemini CLI tool, not project documentation
    - _Bug_Condition: artifact IS GEMINI.md at project root_
    - _Expected_Behavior: file does not exist in the repository_
    - _Requirements: 2.7_

  - [x] 9.2 Delete `scratch/` directory from project root
    - Delete the empty directory — it was committed to Git with no content
    - _Bug_Condition: artifact IS the empty scratch/ directory_
    - _Expected_Behavior: directory does not exist in the repository_
    - _Requirements: 2.8_

- [x] 10. Fix .gitignore for rendered2/ (Issue 9)

  - [x] 10.1 Verify `notes/diagrams/rendered2/` is already in `.gitignore`
    - Confirm `.gitignore` contains the line `notes/diagrams/rendered2/` (it does — confirmed during audit)
    - No change to `.gitignore` is needed
    - _Bug_Condition: notes/diagrams/rendered2/ is NOT in .gitignore — RESOLVED: entry already exists_
    - _Requirements: 2.9_

  - [x] 10.2 Untrack committed PNG files from Git if currently tracked
    - Run `git ls-files notes/diagrams/rendered2/` to check if any PNG files are currently tracked
    - If tracked, run `git rm --cached notes/diagrams/rendered2/*.png` to remove them from Git tracking
    - The files remain on disk — only Git tracking is removed
    - Note: this is a git operation, not a file edit
    - _Requirements: 2.9_

- [x] 11. Fix documentation: scraping-system.md (Issue 12)

  - [x] 11.1 Replace the operational scripts table in `notes/features/scraping-system.md`
    - Replace the existing scripts table with only scripts that exist in `backend/scripts/tools/`:

      | Script | What it does |
      |---|---|
      | `db_health_check.ts` | Full database integrity check |
      | `run_all_scrapes.ts` | Manually trigger all scrapers |
      | `run_catalog_builder.ts` | Run the catalog builder on unmatched listings |
      | `backfill_slugs.ts` | Backfill slugs for components missing them |
      | `check_mbs.ts` | Check motherboard data integrity |
      | `import_benchmarks.ts` | Import benchmark scores from JSON |

    - Remove all references to non-existent scripts: `remap_all.ts`, `shadow_run_matcher.ts`, `evaluate_matcher.ts`, `auto_map_ultrapc.ts`, `auto_map_nextlevel.ts`, `auto_map_setupgame.ts`, `time_scrapers.ts`, `verify_catalog_builder.ts`
    - Also remove the inline reference to `bun scripts/verify_catalog_builder.ts` in the "Quality checks" section (script does not exist)
    - _Bug_Condition: docs list scripts that do NOT exist in backend/scripts/tools/_
    - _Expected_Behavior: docs list only scripts that actually exist_
    - _Requirements: 2.12_

  - [x] 11.2 Update the golden dataset path in `notes/features/scraping-system.md`
    - Change `backend/tests/fixtures/golden_dataset.json` → `backend/src/__tests__/fixtures/golden_dataset.json`
    - _Requirements: 2.12_

- [x] 12. Fix documentation: api.md HTTP method (Issue 13)

  - [x] 12.1 Fix the smart-search endpoint entry in `notes/reference/api.md`
    - Change the section header from `GET /api/components/smart-search` to `POST /api/components/smart-search`
    - Update the description to note that the endpoint accepts a JSON body with `{ build: BuildConfig }` instead of a query parameter
    - Update the parameters section: remove `build` from the query parameters table (it is in the request body, not a query param)
    - Add a request body example showing `{ "category": "cpu", "search": "ryzen", "build": { ... } }`
    - _Bug_Condition: docs document smart-search as GET, actual endpoint is POST_
    - _Expected_Behavior: docs document smart-search as POST with JSON body_
    - _Requirements: 2.13_

- [x] 13. Final verification: run full test suite

  - [x] 13.1 Run `bun test` in `backend/` via WSL2
    - Command: `wsl -d Ubuntu -- bash -c "cd /mnt/c/Headquarters/Projects/PcBuilder/backend && ~/.bun/bin/bun test 2>&1"`
    - **Property 1: Expected Behavior** — all bug condition exploration tests now PASS (bugs are fixed)
    - **Property 2: Preservation** — all preservation tests still PASS (no regressions)
    - Confirm all tests pass (should be 331+ tests)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11, 2.12, 2.13_

  - [x] 13.2 Run TypeScript diagnostics on all modified files
    - Run diagnostics on:
      - `backend/src/routes/admin/logs.ts`
      - `backend/src/routes/admin/unmatched.ts`
      - `backend/src/routes/admin/components.ts`
      - `backend/scraper/session.ts`
      - `frontend/src/types.ts`
    - Confirm zero TypeScript errors across all modified files
    - _Requirements: 2.4, 2.5, 2.10, 2.11_

  - [x] 13.3 Checkpoint — all 13 issues resolved
    - Verify each bug condition now returns false:
      - `smartSearch.ts` and `prices.ts` do not exist
      - All migration filenames have unique numeric prefixes (001–018)
      - `admin/logs.ts` and `admin/unmatched.ts` contain no `import { sql } from 'bun'`
      - `SCRAPER_REGISTRY.find(s => s.id === 10)` returns the UltraPC entry
      - `temp_migrate.ts`, `GEMINI.md`, `scratch/` do not exist
      - `notes/diagrams/rendered2/` is in `.gitignore` and PNG files are untracked
      - `sql.begin()` wrapper is gone from the import handler
      - `RULE_LABELS['form_factor_mismatch']` and `RULE_LABELS['cooler_too_tall']` are defined
      - `notes/features/scraping-system.md` lists only scripts that exist
      - `notes/reference/api.md` documents smart-search as `POST`
    - Ensure all tests pass — ask the user if any questions arise
    - _Requirements: 2.1–2.13, 3.1–3.10_
