# Task — Codebase Cleanup: Audit Round 3 (May 2026)

**What was built:** A third audit pass that fixed 10 code quality and consistency issues.

**Why:** After Rounds 1 and 2 addressed critical bugs and structural issues, Round 3 focused on eliminating remaining duplication, stale artifacts, and minor inconsistencies that accumulated across the development phases.

---

## What was fixed

### 1. Duplicate `getRetailers()` SQL queries merged

**Problem:** The retailer service had two separate query branches — one with an `is_active` filter and one without — that were nearly identical SQL.

**Fix:** Merged into a single query using a nullable parameter: `${isActive ?? null}::boolean IS NULL OR is_active = ${isActive ?? null}`.

**Files changed:**
- `backend/src/services/retailerService.ts`

---

### 2. Bulk import coercion missing migration 019 fields

**Problem:** The bulk import handler in `admin/components.ts` coerced string values to numbers for CSV imports, but the list of numeric fields didn't include `max_cooler_height_mm`, `height_mm`, or `benchmark_score` — all added in migration 019. Importing these fields from CSV would silently fail Zod validation.

**Fix:** Added the three missing fields to the `numericFields` array in the import handler.

**Files changed:**
- `backend/src/routes/admin/components.ts`

---

### 3. `case` removed from TDP sum

**Problem:** The compatibility engine included `case` in the `total_tdp` calculation. A PC case is a passive enclosure — it draws no power. Including it inflated the recommended PSU wattage.

**Fix:** Removed `case` from the `componentKeys` array used in the TDP reduce.

**Files changed:**
- `backend/src/services/compatibilityService.ts`

---

### 4. Remaining stale `.gitkeep` files deleted

**Problem:** `.gitkeep` files in `scraper/scrapers/` and `scraper/utils/` were left over from when those directories were first created empty. They serve no purpose once real files exist.

**Fix:** Deleted the stale `.gitkeep` files.

---

### 5. Architecture guide migration count corrected

**Problem:** `notes/guide/architecture.md` listed the migrations directory as `(001–018)` after migration 019 was added.

**Fix:** Updated the directory structure comment to `(001–019)`.

**Files changed:**
- `notes/guide/architecture.md`

---

### 6. Manual cookie regex replaced with Hono helper

**Problem:** `auth.ts` parsed the `Cookie` header manually using a regex to extract the refresh token. Hono provides a `getCookie()` helper that handles this correctly and handles edge cases.

**Fix:** Replaced the manual regex with `getCookie(c, 'refresh_token')`.

**Files changed:**
- `backend/src/routes/auth.ts`

---

### 7. Unused Vite boilerplate assets deleted

**Problem:** `react.svg` and `vite.svg` were left over from the Vite project scaffold in both the frontend and admin apps. They were never used in the actual UI.

**Fix:** Deleted both files from `frontend/src/assets/` and `admin/src/assets/`.

---

### 8. `ScraperLog` interface moved to top of `admin/logs.ts`

**Problem:** The `ScraperLog` interface was defined inline inside the route handler, making it harder to find and reuse.

**Fix:** Moved it to the top of the file, before the router definition.

**Files changed:**
- `backend/src/routes/admin/logs.ts`

---

### 9. Dynamic `import('./api')` replaced with static import in `App.tsx`

**Problem:** The admin panel's `App.tsx` used a dynamic `import('./api')` call inside a component. Dynamic imports inside components re-execute on every render and bypass tree-shaking.

**Fix:** Replaced with a static `import { api } from './api'` at the top of the file.

**Files changed:**
- `admin/src/App.tsx`

---

### 10. `ScraperInstance` index-signature interface replaced

**Problem:** `session.ts` used a loose index-signature interface (`{ [key: string]: any }`) to type scraper instances. This provided no type safety for the `run` method.

**Fix:** Replaced with a typed `run: () => Promise<ScrapedPrice[]>` function reference directly in the `SCRAPER_REGISTRY` array type.

**Files changed:**
- `backend/scraper/session.ts`

---

## Tests

All tests continue to pass after these changes. No new tests were added for this round.
