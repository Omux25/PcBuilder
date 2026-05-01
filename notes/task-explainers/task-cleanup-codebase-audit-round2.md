# Task — Codebase Cleanup: Audit Round 2 (May 2026)

**What was built:** A second audit pass that fixed 9 bugs found after the first cleanup round.

**Why:** The first audit resolved the most visible issues. A second pass caught deeper problems: silently dead compatibility rules, a PSU TDP calculation error, a non-transactional preset creation, and several code quality issues.

---

## What was fixed

### 1. Compatibility Rules 5 & 6 silently dead

**Problem:** Rules 5 (form_factor_mismatch) and 6 (cooler_too_tall) only worked if a component had been created with the relevant data in the `specs` JSONB column. Components created through the admin API had no way to set `supported_motherboards`, `max_cooler_height_mm`, or `height_mm` as first-class fields — so the rules never fired for them.

**Fix:** Added `height_mm`, `supported_motherboards`, `max_cooler_height_mm`, and `form_factor` to the Zod schemas (`componentSchemas.ts`) and to the `components` table via migration 019. The compatibility engine already read these fields — it just had no data to work with.

**Files changed:**
- `backend/src/schemas/componentSchemas.ts` — added fields to `caseSchema` and `coolingSchema`
- `backend/src/db/migrations/019_add_compatibility_columns.sql` — new migration

---

### 2. PSU TDP incorrectly included in `total_tdp`

**Problem:** The TDP sum in `compatibilityService.ts` included the PSU. A PSU supplies power — it doesn't consume it in the same way. Including it inflated `recommended_psu_wattage`, which is calculated as `ceil(total_tdp × 1.5)`.

**Fix:** Removed `psu` from the `componentKeys` array used in the TDP reduce.

**Files changed:**
- `backend/src/services/compatibilityService.ts`

---

### 3. `createPreset` not transactional

**Problem:** Creating a preset involved two separate SQL operations: inserting into `preset_builds`, then inserting rows into `preset_build_components`. If the server crashed between them, a partial preset (header with no components) could be left in the database.

**Fix:** Wrapped both operations in `sql.begin()` so they succeed or fail together.

**Files changed:**
- `backend/src/services/presetService.ts`

---

### 4. LIKE token injection in search

**Problem:** The token-based search in `getComponents()` escaped the full query string but not the individual tokens. A search for `"rtx_4090"` would have `_` act as a wildcard in the per-token LIKE conditions.

**Fix:** Added `escapeLikeToken()` helper that escapes `%` and `_` in each token before embedding it in the LIKE condition.

**Files changed:**
- `backend/src/services/componentService.ts`

---

### 5. ID validation duplicated across admin routes

**Problem:** Every admin route that accepted an `:id` parameter had the same 3-line validation block:
```typescript
const id = Number(raw);
if (!Number.isInteger(id) || id <= 0) {
  return c.json({ error: { code: 'VALIDATION_ERROR', message: 'id must be a positive integer' } }, 400);
}
```
This appeared 4+ times across different files.

**Fix:** Extracted `parseId()` helper to `admin/types.ts`. Returns the parsed number or `null` if invalid.

**Files changed:**
- `backend/src/routes/admin/types.ts` — added `parseId()`
- `backend/src/routes/admin/components.ts`, `retailers.ts`, `scrapers.ts`, `unmatched.ts`, `presets.ts` — replaced inline blocks with `parseId()`

---

### 6. `getPriceHistory` had two near-identical SQL queries

**Problem:** The price history service had two separate query branches — one with a retailer filter and one without — that were almost identical.

**Fix:** Merged into a single query using a nullable parameter: `${retailerId ?? null}::integer IS NULL OR retailer_id = ${retailerId ?? null}`.

**Files changed:**
- `backend/src/services/priceHistoryService.ts`

---

### 7. Placeholder scraper files deleted

**Problem:** `site1Scraper.ts` and `site2Scraper.ts` were placeholder files from Phase 5 that were never replaced with real scrapers. They still existed in the codebase alongside their test files.

**Fix:** Deleted both files and their tests.

**Files deleted:**
- `backend/scraper/scrapers/site1Scraper.ts`
- `backend/scraper/scrapers/site2Scraper.ts`
- `backend/scraper/scrapers/__tests__/site1Scraper.test.ts`
- `backend/scraper/scrapers/__tests__/site2Scraper.test.ts`

---

### 8. Stale `.gitkeep` files

**Problem:** `.gitkeep` files in `routes/` and `middleware/` directories were left over from when those directories were first created empty. They serve no purpose once real files exist.

**Fix:** Deleted the stale `.gitkeep` files.

---

### 9. `notes/audit-report.md` dated April 2026

**Problem:** The audit report was dated April 2026 but the work was done in May 2026.

**Fix:** Updated the date.

---

## Tests

All 362 tests continue to pass after these changes. No new tests were added for this round — the existing test suite covers the affected code paths.
