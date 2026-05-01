# Task — Codebase Cleanup (Audit Round 1)

**What was built:** A systematic cleanup of 13 discrete bugs and structural issues found during a full codebase audit.

**Why:** The codebase had accumulated dead code, infrastructure mismatches, and documentation inaccuracies that would silently break features or mislead developers.

---

## Issues Fixed

### Dead code removed

- `backend/src/routes/smartSearch.ts` — exported `smartSearchRouter` that was never mounted in `app.ts`. The canonical smart search lives in `components.ts` at `POST /api/components/smart-search`.
- `backend/src/routes/prices.ts` — exported `pricesRouter` that was never mounted. The canonical prices endpoint lives in `components.ts` at `GET /api/components/:id/prices`.
- `backend/src/routes/__tests__/prices.test.ts` — test file for the dead prices route.
- `backend/src/db/temp_migrate.ts` — one-off migration script with hardcoded credentials (`postgres:postgres@127.0.0.1:5433`) committed to the production source tree.
- `GEMINI.md` — stale Gemini CLI config file at the project root.
- `scratch/` — empty directory committed to Git.

### Infrastructure bugs fixed

**Duplicate migration prefix 015** — `015_fix_ram_types_encoding.sql` was added after `015_add_benchmark_score.sql` already existed. Any migration runner tracking by number would skip one silently. Fixed by renaming:
- `015_fix_ram_types_encoding.sql` → `016_fix_ram_types_encoding.sql`
- `016_add_trigram_index.sql` → `017_add_trigram_index.sql`
- `017_hash_refresh_tokens.sql` → `018_hash_refresh_tokens.sql`

**DI bypass in admin routes** — `admin/logs.ts` and `admin/unmatched.ts` imported `sql` directly from `bun` instead of using `getSql()` from `db/index.ts`. This made them impossible to test with a mocked SQL connection. Fixed by replacing the direct import with `getSql()` in both files.

**Scraper registry ID mismatch** — `SCRAPER_REGISTRY` in `session.ts` had UltraPC→id:1, NextLevel→id:2, SetupGame→id:3. The actual database retailer IDs are 10, 11, 13. Calling `POST /api/admin/scrapers/10/run` would silently do nothing because no scraper matched id 10. Fixed by updating the registry IDs to match the database.

### Code quality fixes

**Broken `sql.begin()` wrapper in bulk import** — `POST /api/admin/components/import` wrapped the import loop in `sql.begin()` but called `createComponent()` internally, which calls `getSql()` (the global connection, not the transaction object). The `_tx` parameter was never used — no actual atomicity was provided. Removed the wrapper entirely. The existing per-row `try/catch` is the honest behavior: each row either succeeds or is counted as failed/skipped.

**Missing `RULE_LABELS` and `RULE_TOOLTIPS` entries** — Rules `form_factor_mismatch` and `cooler_too_tall` were implemented in `compatibilityService.ts` but their French display labels and tooltips were missing from `frontend/src/types.ts`. The UI would render blank labels for those compatibility errors. Added both entries to both maps.

### Documentation fixes

- `notes/features/scraping-system.md` — removed references to 8 non-existent scripts (`remap_all.ts`, `shadow_run_matcher.ts`, etc.). Updated the golden dataset path.
- `notes/reference/api.md` — changed smart-search endpoint from `GET` to `POST` (the actual HTTP method).
- `.gitignore` — `notes/diagrams/rendered2/` entry was already present; confirmed PNG files were untracked.

---

## Files Changed

**Deleted:**
- `backend/src/routes/smartSearch.ts`
- `backend/src/routes/prices.ts`
- `backend/src/routes/__tests__/prices.test.ts`
- `backend/src/db/temp_migrate.ts`
- `GEMINI.md`
- `scratch/` (empty directory)

**Renamed:**
- `015_fix_ram_types_encoding.sql` → `016_fix_ram_types_encoding.sql`
- `016_add_trigram_index.sql` → `017_add_trigram_index.sql`
- `017_hash_refresh_tokens.sql` → `018_hash_refresh_tokens.sql`

**Modified:**
- `backend/scraper/session.ts` — registry IDs corrected (1→10, 2→11, 3→13)
- `backend/src/routes/admin/logs.ts` — DI bypass fixed
- `backend/src/routes/admin/unmatched.ts` — DI bypass fixed
- `backend/src/routes/admin/components.ts` — broken `sql.begin()` wrapper removed
- `frontend/src/types.ts` — `RULE_LABELS` and `RULE_TOOLTIPS` completed
- `notes/features/scraping-system.md` — scripts table corrected
- `notes/reference/api.md` — smart-search HTTP method corrected

**Added:**
- `backend/src/__tests__/bugCondition.test.ts` — confirms all 13 bug conditions are eliminated
- `backend/src/__tests__/preservation.test.ts` — confirms no regressions in baseline behaviors

---

## Tests

All 354 tests pass after the cleanup. The bug condition tests (`bugCondition.test.ts`) now pass, confirming every fix is in place. The preservation tests (`preservation.test.ts`) confirm no regressions.
