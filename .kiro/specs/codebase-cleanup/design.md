# Codebase Cleanup Bugfix Design

## Overview

This document formalizes the fix strategy for 13 discrete codebase issues identified in the PC Builder Maroc project. The issues span four categories: dead code (Issues 1, 2, 6, 7, 8), structural/infrastructure bugs (Issues 3, 4, 5, 10), UI data gaps (Issue 11), and documentation inaccuracies (Issues 12, 13).

The fix approach is surgical: each issue is addressed with the minimal change that eliminates the defect without touching unrelated code. No refactoring beyond what is required to fix the bug condition.

---

## Glossary

- **Bug_Condition (C)**: The condition that identifies a defective state in the codebase — a file that should not exist, a value that is wrong, a behavior that is broken.
- **Property (P)**: The desired correct state after the fix is applied.
- **Preservation**: All behaviors not covered by the bug condition that must remain unchanged after the fix.
- **Dead code**: Source files that are never imported or executed at runtime.
- **DI bypass**: Importing `sql` directly from `bun` instead of using `getSql()` from `db/index.ts`, which breaks test mocking.
- **SCRAPER_REGISTRY**: The array in `backend/scraper/session.ts` that maps scraper instances to retailer database IDs.
- **getSql()**: The centralized database accessor in `backend/src/db/index.ts` that supports dependency injection for testing.
- **sql.begin()**: Bun.sql's transaction wrapper — the callback receives a transaction-scoped `tx` connection that must be used for all queries inside the transaction.
- **RULE_LABELS**: A `Record<string, string>` in `frontend/src/types.ts` mapping compatibility rule keys to French display labels.
- **RULE_TOOLTIPS**: A `Record<string, string>` in `frontend/src/types.ts` mapping compatibility rule keys to French tooltip descriptions.

---

## Bug Details

### Bug Condition

The codebase contains 13 distinct defects. Each is formalized below.

**Formal Specification:**

```
FUNCTION isBugCondition(artifact)
  INPUT: any file, value, or behavior in the repository
  OUTPUT: boolean

  // Issues 1 & 2 — Dead route files
  IF artifact IS a route file
     AND artifact exports a router
     AND that router is NOT imported in app.ts
    RETURN true

  // Issue 3 — Duplicate migration number
  IF artifact IS the set of migration filenames in backend/src/db/migrations/
     AND two files share the same numeric prefix
    RETURN true

  // Issue 4 — DI bypass
  IF artifact IS a route handler file
     AND artifact contains "import { sql } from 'bun'"
    RETURN true

  // Issue 5 — Scraper registry ID mismatch
  IF artifact IS an entry in SCRAPER_REGISTRY
     AND entry.id does NOT match the actual retailer.id in the database
     AND the retailer is a real production retailer (UltraPC, NextLevel, SetupGame)
    RETURN true

  // Issues 6, 7, 8 — Stale/empty artifacts
  IF artifact IS backend/src/db/temp_migrate.ts
     OR artifact IS GEMINI.md at project root
     OR artifact IS the empty scratch/ directory
    RETURN true

  // Issue 9 — Missing .gitignore entry
  IF artifact IS notes/diagrams/rendered2/
     AND .gitignore does NOT contain "notes/diagrams/rendered2/"
    RETURN true

  // Issue 10 — Broken transaction
  IF artifact IS the sql.begin() block in POST /api/admin/components/import
     AND createComponent() inside the block calls getSql() (global connection, not tx)
    RETURN true

  // Issue 11 — Missing RULE_LABELS / RULE_TOOLTIPS entries
  IF artifact IS RULE_LABELS or RULE_TOOLTIPS in frontend/src/types.ts
     AND artifact does NOT contain an entry for 'form_factor_mismatch'
     AND artifact does NOT contain an entry for 'cooler_too_tall'
    RETURN true

  // Issue 12 — Docs reference non-existent scripts
  IF artifact IS notes/features/scraping-system.md
     AND artifact lists scripts that do NOT exist in backend/scripts/tools/
    RETURN true

  // Issue 13 — Wrong HTTP method in API docs
  IF artifact IS notes/reference/api.md
     AND artifact documents the smart-search endpoint as GET
    RETURN true

  RETURN false
END FUNCTION
```

### Examples

**Issue 1:** `backend/src/routes/smartSearch.ts` exports `smartSearchRouter`. Searching `app.ts` for `smartSearchRouter` returns zero results — it is never mounted. The canonical implementation lives in `components.ts` at `POST /api/components/smart-search`.

**Issue 3:** `ls backend/src/db/migrations/` shows both `015_add_benchmark_score.sql` and `015_fix_ram_types_encoding.sql`. Any migration runner tracking applied migrations by number will either skip one or fail.

**Issue 4:** `backend/src/routes/admin/logs.ts` line 1: `import { sql } from 'bun'`. Every other route uses `getSql()`. This file cannot be tested with a mocked SQL connection.

**Issue 5:** `POST /api/admin/scrapers/10/run` calls `runScrapingSession(10)`. Inside, `SCRAPER_REGISTRY.filter(s => s.id === 10)` returns `[]` because UltraPC is registered as `id: 1`. The scrape silently does nothing.

**Issue 10:** `sql.begin(async (_tx) => { ... await createComponent(...) ... })` — `createComponent` calls `getSql()` internally, which returns the global connection, not `_tx`. The `_tx` parameter is never used. No actual transaction is in effect.

**Issue 11:** `RULE_LABELS['form_factor_mismatch']` → `undefined`. The compatibility engine in `compatibilityService.ts` emits `form_factor_mismatch` and `cooler_too_tall` errors (Rules 7 and 8), but the frontend label maps have no entries for them.

---

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**

- `GET /api/components/:id/prices` continues to return price offers (served by `components.ts`)
- `POST /api/components/smart-search` continues to return enriched components (served by `components.ts`)
- `POST /api/admin/scrapers/run-all` continues to trigger all active scrapers
- `GET /api/admin/unmatched-listings` continues to return unmatched listings after the DI fix
- `GET /api/admin/logs` continues to return scraper logs after the DI fix
- `POST /api/admin/components/import` with a clean file (no errors) continues to import all rows successfully
- All existing compatibility rules (`socket_mismatch`, `ram_type_mismatch`, `ram_frequency_exceeded`, `gpu_too_long`, `psu_underpowered`) continue to display correct labels and tooltips
- All migrations 001–015 (the original `015_add_benchmark_score.sql`) continue to apply in order on a fresh database
- All routes other than `admin/unmatched.ts` and `admin/logs.ts` continue to use `getSql()` unchanged

**Scope:**

All inputs and behaviors that do NOT involve the 13 identified bug conditions are completely unaffected by this fix. The changes are strictly additive (new `.gitignore` entry, new `RULE_LABELS`/`RULE_TOOLTIPS` entries) or subtractive (file deletions, removing broken wrapper code) with no logic changes to any working feature.

---

## Hypothesized Root Cause

### Issues 1 & 2 — Dead route files

`smartSearch.ts` and `prices.ts` were created during early development before the smart-search and prices endpoints were consolidated into `components.ts`. They were never cleaned up. The `app.ts` file never imported them, so they have been silently dead since consolidation.

### Issue 3 — Duplicate migration 015

`015_fix_ram_types_encoding.sql` was added after `015_add_benchmark_score.sql` already existed, without incrementing the prefix. The developer likely created the file without checking the existing highest number.

### Issue 4 — DI bypass in admin routes

`admin/logs.ts` and `admin/unmatched.ts` were written before the centralized `db/index.ts` DI pattern was established (or were not updated when the pattern was introduced). They import `sql` directly from `bun`, bypassing the injectable layer.

### Issue 5 — Scraper registry ID mismatch

The `SCRAPER_REGISTRY` was written with placeholder IDs (1, 2, 3) before the actual retailer rows were inserted into the database. The database assigned IDs 10, 11, 13 (likely due to auto-increment starting point or prior deletions). The registry was never updated to match.

### Issue 6 — temp_migrate.ts in production tree

`temp_migrate.ts` is a one-off script written to run a specific migration manually during development. It was committed to the repository and never deleted. It contains hardcoded credentials (`postgres:postgres@127.0.0.1:5433`) that should not be in the source tree.

### Issues 7 & 8 — Stale artifacts

`GEMINI.md` is a configuration file for the Gemini CLI tool, committed accidentally. `scratch/` is an empty directory that was committed (possibly via a `.gitkeep` that was later removed).

### Issue 9 — Missing .gitignore entry

`.gitignore` excludes `notes/diagrams/rendered/` but not `notes/diagrams/rendered2/`. The `rendered2/` directory was created as a second output directory and its generated PNGs were committed before the gitignore entry was added.

### Issue 10 — Broken transaction in bulk import

The `sql.begin()` wrapper was added with the intent of making the import atomic, but `createComponent()` in `componentService.ts` calls `getSql()` internally — it has no parameter to accept an external transaction connection. The `_tx` object passed to the `sql.begin()` callback is never threaded through to the actual INSERT statements. The transaction wrapper is therefore a no-op that adds false confidence of atomicity.

The simplest correct fix is to remove the `sql.begin()` wrapper entirely. The existing row-by-row `try/catch` already handles errors per row. Removing the broken wrapper makes the behavior honest: it is row-by-row with individual error handling, which is what actually happens. Threading the transaction through `createComponent()` would require a large refactor of the service layer and is out of scope.

### Issue 11 — Missing RULE_LABELS / RULE_TOOLTIPS

Rules 7 (`form_factor_mismatch`) and 8 (`cooler_too_tall`) were added to `compatibilityService.ts` but the corresponding frontend label and tooltip entries were not added to `frontend/src/types.ts`. The maps were not updated in sync with the service.

### Issues 12 & 13 — Documentation inaccuracies

`scraping-system.md` was written when more scripts existed (or were planned). Several scripts were removed or never created, but the docs were not updated. The golden dataset path was also incorrect. The `api.md` smart-search entry was written when the endpoint was a GET, before it was changed to POST to support a JSON body.

---

## Correctness Properties

Property 1: Bug Condition — All 13 Defects Are Eliminated

_For any_ artifact in the repository where `isBugCondition(artifact)` returns true, after applying the fix, `isBugCondition(artifact)` SHALL return false — meaning: dead files are deleted, migration numbers are unique, DI bypasses are replaced with `getSql()`, registry IDs match database IDs, the broken transaction wrapper is removed, missing label/tooltip entries are present, and documentation reflects reality.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11, 2.12, 2.13**

Property 2: Preservation — All Non-Buggy Behaviors Are Unchanged

_For any_ behavior or artifact where `isBugCondition` returns false (all mounted routes, all working services, all existing compatibility rules, all passing tests), the fixed codebase SHALL produce exactly the same behavior as the original codebase — no regressions in API responses, database operations, scraper execution, or frontend rendering.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10**

---

## Fix Implementation

### Changes Required

#### Issue 1 — Delete `backend/src/routes/smartSearch.ts`

**File:** `backend/src/routes/smartSearch.ts`
**Action:** Delete the file entirely.
**Also delete:** `backend/src/routes/__tests__/prices.test.ts` (tests the dead prices route — see Issue 2).

No changes to `app.ts` needed (the file was never imported there).

---

#### Issue 2 — Delete `backend/src/routes/prices.ts`

**File:** `backend/src/routes/prices.ts`
**Action:** Delete the file entirely.

No changes to `app.ts` needed.

---

#### Issue 3 — Rename migration files to resolve duplicate 015

**Files to rename:**

| Current name | New name |
|---|---|
| `015_fix_ram_types_encoding.sql` | `016_fix_ram_types_encoding.sql` |
| `016_add_trigram_index.sql` | `017_add_trigram_index.sql` |
| `017_hash_refresh_tokens.sql` | `018_hash_refresh_tokens.sql` |

**Also delete:** `backend/src/db/temp_migrate.ts` (Issue 6 — references the old filename and contains hardcoded credentials).

The migration runner (`backend/src/db/migrate.ts`) reads files by sorted filename, so renaming is sufficient. No SQL content changes.

---

#### Issue 4 — Fix DI bypass in `admin/logs.ts` and `admin/unmatched.ts`

**File:** `backend/src/routes/admin/logs.ts`

**Specific changes:**
1. Replace `import { sql } from 'bun'` with `import { getSql } from '../../db/index.js'`
2. At the top of the route handler, add `const sql = getSql()`
3. All `sql\`` template literal calls remain syntactically identical — only the source of `sql` changes

**File:** `backend/src/routes/admin/unmatched.ts`

**Specific changes:**
1. Replace `import { sql } from 'bun'` with `import { getSql } from '../../db/index.js'`
2. At the top of each route handler that uses `sql`, add `const sql = getSql()`
3. All `sql\`` template literal calls remain syntactically identical

---

#### Issue 5 — Fix scraper registry IDs

**File:** `backend/scraper/session.ts`

**Specific changes:**

```typescript
// Before
{ id: 1,   name: 'UltraPC',      ... }
{ id: 2,   name: 'NextLevel PC', ... }
{ id: 3,   name: 'SetupGame',    ... }
{ id: 101, name: 'Site1',        ... }
{ id: 102, name: 'Site2',        ... }

// After
{ id: 10,  name: 'UltraPC',      ... }
{ id: 11,  name: 'NextLevel PC', ... }
{ id: 13,  name: 'SetupGame',    ... }
{ id: 101, name: 'Site1',        ... }  // placeholder — unchanged
{ id: 102, name: 'Site2',        ... }  // placeholder — unchanged
```

Only the `id` values for the three production scrapers change. All other fields are unchanged.

---

#### Issue 6 — Delete `backend/src/db/temp_migrate.ts`

**File:** `backend/src/db/temp_migrate.ts`
**Action:** Delete the file entirely.

Handled together with Issue 3 since `temp_migrate.ts` references the old migration filename.

---

#### Issue 7 — Delete `GEMINI.md`

**File:** `GEMINI.md` (project root)
**Action:** Delete the file entirely.

---

#### Issue 8 — Delete `scratch/` directory

**Directory:** `scratch/` (project root)
**Action:** Delete the directory. It is empty, so no content is lost.

---

#### Issue 9 — Add `notes/diagrams/rendered2/` to `.gitignore`

**File:** `.gitignore`

**Specific change:** The entry `notes/diagrams/rendered2/` is already present in `.gitignore` (confirmed by reading the file). No change needed to `.gitignore` itself.

**Action:** Remove the committed PNG files from Git tracking with `git rm --cached notes/diagrams/rendered2/` if they are currently tracked. The `.gitignore` entry already exists.

---

#### Issue 10 — Remove broken `sql.begin()` wrapper in bulk import

**File:** `backend/src/routes/admin/components.ts`

**Specific changes:**

Remove the `sql.begin(async (_tx) => { ... })` wrapper and the outer `try/catch` that catches catastrophic transaction failure. Keep the inner per-row `try/catch` loop intact. The `const sql = ...` line at the top of the handler is also removed since `getSql()` is already imported via the service layer.

```typescript
// Before (simplified)
const sql = (await import('../../db/index.js')).getSql();
try {
  await sql.begin(async (_tx: SqlFn) => {
    for (let i = 0; i < rawData.length; i++) {
      try {
        // ... validate and createComponent()
        results.imported++;
      } catch (err) {
        // per-row error handling
      }
    }
  });
} catch (err) {
  return c.json({ error: { code: 'INTERNAL_ERROR', ... } }, 500);
}

// After (simplified)
for (let i = 0; i < rawData.length; i++) {
  try {
    // ... validate and createComponent()
    results.imported++;
  } catch (err) {
    // per-row error handling — unchanged
  }
}
```

Also remove the `import type { SqlFn } from '../../db/index.js'` import since `SqlFn` is only used as the `_tx` parameter type.

---

#### Issue 11 — Add missing `RULE_LABELS` and `RULE_TOOLTIPS` entries

**File:** `frontend/src/types.ts`

**Specific changes:**

Add to `RULE_LABELS`:
```typescript
form_factor_mismatch: 'Format de carte mère incompatible',
cooler_too_tall:      'Refroidissement trop haut pour le boîtier',
```

Add to `RULE_TOOLTIPS`:
```typescript
form_factor_mismatch: 'La carte mère ne rentre pas dans ce boîtier. Vérifiez les formats supportés (ATX, mATX, ITX).',
cooler_too_tall:      'Le ventirad CPU est trop haut pour ce boîtier. Vérifiez la hauteur maximale supportée.',
```

---

#### Issue 12 — Fix `notes/features/scraping-system.md` operational scripts table

**File:** `notes/features/scraping-system.md`

**Specific changes:**

Replace the operational scripts table with only scripts that exist in `backend/scripts/tools/`:

| Script | What it does |
|---|---|
| `db_health_check.ts` | Full database integrity check |
| `run_all_scrapes.ts` | Manually trigger all scrapers |
| `run_catalog_builder.ts` | Run the catalog builder on unmatched listings |
| `backfill_slugs.ts` | Backfill slugs for components missing them |
| `check_mbs.ts` | Check motherboard data integrity |
| `import_benchmarks.ts` | Import benchmark scores from JSON |

Remove references to: `remap_all.ts`, `shadow_run_matcher.ts`, `evaluate_matcher.ts`, `auto_map_ultrapc.ts`, `auto_map_nextlevel.ts`, `auto_map_setupgame.ts`, `time_scrapers.ts`, `verify_catalog_builder.ts`.

Also update the golden dataset path from `backend/tests/fixtures/golden_dataset.json` to `backend/src/__tests__/fixtures/golden_dataset.json`.

---

#### Issue 13 — Fix HTTP method in `notes/reference/api.md`

**File:** `notes/reference/api.md`

**Specific changes:**

1. Change the section header from `GET /api/components/smart-search` to `POST /api/components/smart-search`
2. Update the description to note that the endpoint accepts a JSON body with `{ build: BuildConfig }`
3. Update the query parameters table to remove `build` as a query param (it is now in the request body)

---

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, confirm the bug conditions exist on the unfixed code (exploratory), then verify each fix eliminates the bug condition without breaking preserved behaviors.

Because most of these issues are structural (wrong values, wrong files, wrong docs) rather than algorithmic, the primary validation method is static inspection and targeted unit tests. Property-based testing is applied where the input space is large enough to benefit from it (Issue 10 bulk import, Issue 5 scraper dispatch).

### Exploratory Bug Condition Checking

**Goal:** Confirm each bug condition exists before applying the fix. Surface counterexamples.

**Test Plan:** For each issue, write a test or inspection that demonstrates the defect on unfixed code.

**Test Cases:**

1. **Issue 1 — Dead smartSearch.ts**: Inspect `app.ts` imports — `smartSearchRouter` is absent. (Static check — will confirm on unfixed code)
2. **Issue 3 — Duplicate migration**: List migration files and assert all numeric prefixes are unique — will fail on unfixed code with two `015_` files.
3. **Issue 4 — DI bypass**: In a test, call `setSql(mockSql)` then `GET /api/admin/logs` — the mock will not be called, confirming the bypass. (Will fail on unfixed code)
4. **Issue 5 — Registry mismatch**: Call `runScrapingSession(10)` — assert that a scraper was found and executed. Will fail on unfixed code (no scraper found for id 10).
5. **Issue 10 — Broken transaction**: Send an import batch with one valid row followed by one invalid row. Assert that after the failed import, the valid row was NOT persisted. Will fail on unfixed code (the valid row is persisted because there is no real transaction).
6. **Issue 11 — Missing labels**: Assert `RULE_LABELS['form_factor_mismatch'] !== undefined`. Will fail on unfixed code.

**Expected Counterexamples:**
- `SCRAPER_REGISTRY.filter(s => s.id === 10)` returns `[]` on unfixed code
- `RULE_LABELS['form_factor_mismatch']` returns `undefined` on unfixed code
- Import of one valid + one invalid row leaves the valid row in the database on unfixed code

### Fix Checking

**Goal:** Verify that for all inputs where the bug condition holds, the fixed code produces the expected behavior.

**Pseudocode:**
```
FOR ALL artifact WHERE isBugCondition(artifact) DO
  result := inspect_fixed_codebase(artifact)
  ASSERT isBugCondition(result) = false
END FOR
```

**Specific assertions after fix:**
- `smartSearch.ts` and `prices.ts` do not exist in the repository
- All migration filenames have unique numeric prefixes (001–018, no duplicates)
- `admin/logs.ts` and `admin/unmatched.ts` contain no `import { sql } from 'bun'`
- `SCRAPER_REGISTRY.find(s => s.id === 10)` returns the UltraPC entry
- `temp_migrate.ts`, `GEMINI.md`, `scratch/` do not exist
- `notes/diagrams/rendered2/` is in `.gitignore`
- `POST /api/admin/components/import` with mixed valid/invalid rows: valid rows are persisted, invalid rows are skipped/failed, no catastrophic rollback
- `RULE_LABELS['form_factor_mismatch']` and `RULE_LABELS['cooler_too_tall']` are defined strings
- `notes/features/scraping-system.md` lists only scripts that exist in `backend/scripts/tools/`
- `notes/reference/api.md` documents smart-search as `POST`

### Preservation Checking

**Goal:** Verify that for all inputs where the bug condition does NOT hold, the fixed code produces the same result as the original code.

**Pseudocode:**
```
FOR ALL behavior WHERE NOT isBugCondition(behavior) DO
  ASSERT original_behavior(behavior) = fixed_behavior(behavior)
END FOR
```

**Test Cases:**

1. **Route preservation**: `GET /api/components/:id/prices` and `POST /api/components/smart-search` return correct responses after deleting the dead route files (they were never mounted, so no change in behavior).
2. **Migration order preservation**: Running all migrations 001–018 on a fresh database produces the same schema as running 001–017 on the original numbering (same SQL content, just renumbered).
3. **DI preservation**: After fixing `admin/logs.ts` and `admin/unmatched.ts`, calling `GET /api/admin/logs` and `GET /api/admin/unmatched-listings` with a valid JWT returns the same data as before.
4. **Scraper run-all preservation**: `POST /api/admin/scrapers/run-all` continues to trigger all scrapers (the registry fix only changes targeted scraping by ID).
5. **Import clean-file preservation**: `POST /api/admin/components/import` with a file containing no errors imports all rows successfully (same behavior as before — the broken transaction wrapper was a no-op for clean files).
6. **Existing rule labels preservation**: `RULE_LABELS['socket_mismatch']`, `RULE_LABELS['gpu_too_long']`, etc. remain unchanged after adding the two new entries.

### Unit Tests

- Test that `SCRAPER_REGISTRY` entries for UltraPC, NextLevel, SetupGame have IDs 10, 11, 13 respectively
- Test that `RULE_LABELS` and `RULE_TOOLTIPS` contain entries for all 7 rules (5 existing + 2 new)
- Test that `admin/logs.ts` route handler uses `getSql()` (mock injection test)
- Test that `admin/unmatched.ts` route handler uses `getSql()` (mock injection test)
- Test bulk import with a clean batch: all rows imported, count matches
- Test bulk import with a mixed batch: valid rows imported, invalid rows counted as failed, no crash

### Property-Based Tests

- Generate random arrays of component rows (mix of valid and invalid) and verify that the import handler always returns `imported + skipped + failed === total_rows` (no rows are silently lost)
- Generate random retailer IDs and verify that `runScrapingSession(id)` either finds a scraper and runs it, or logs a warning and returns — never throws an unhandled exception
- Generate random compatibility rule keys and verify that every key returned by `validateCompatibility()` has a corresponding entry in both `RULE_LABELS` and `RULE_TOOLTIPS`

### Integration Tests

- Full migration run on a fresh database: apply all 18 migrations in order, assert no errors and schema matches expected structure
- End-to-end scraper dispatch: call `POST /api/admin/scrapers/10/run` with mocked scraper, assert the UltraPC scraper is invoked
- End-to-end compatibility display: trigger a `form_factor_mismatch` error via the compatibility API, assert the frontend renders a non-empty label and tooltip
