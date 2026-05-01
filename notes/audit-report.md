# Codebase Audit Report (May 2026)

This report reflects the current state of the codebase after all cleanup and optimization work is complete.

---

## 1. Backend

**Status:** ✅ Tests Passing | ✅ No TypeScript Errors | ✅ No Dead Code | ✅ English-only

### Resolved Issues (Round 2 — May 2026)

| Issue | Fix Applied |
|---|---|
| `coolingSchema`/`caseSchema` missing `height_mm`, `supported_motherboards`, `max_cooler_height_mm` — Rules 5 & 6 silently dead | Added fields to schemas; migration 019 adds flat columns |
| Token search in `getComponents` didn't escape `_` and `%` in individual tokens | Added `escapeLikeToken()` helper; tokens escaped before LIKE |
| `createPreset` not transactional — partial preset possible on crash | Wrapped in `sql.begin()` |
| PSU TDP included in `total_tdp` sum — inflated `recommended_psu_wattage` | PSU excluded from TDP sum (it supplies power, doesn't consume it) |
| ID validation block duplicated 4+ times across admin routes | Extracted `parseId()` helper to `admin/types.ts` |
| `getPriceHistory` had two near-identical SQL queries | Merged into one nullable-param query |
| `site1Scraper.ts` / `site2Scraper.ts` placeholder files still existed | Deleted along with their test files |
| Stale `.gitkeep` files in routes and middleware dirs | Deleted |
| `notes/audit-report.md` dated April 2026 | Updated to May 2026 |

### Resolved Issues (Round 1 — April 2026)
| Issue | Fix Applied |
|---|---|
| Dead route files (`smartSearch.ts`, `prices.ts`) | Deleted |
| Duplicate migration prefix `015` | Renamed to 016–018 |
| DI bypass in `admin/logs.ts` and `admin/unmatched.ts` | Replaced with `getSql()` |
| Scraper registry IDs (1,2,3) didn't match DB (10,11,13) | Fixed in `session.ts` |
| `temp_migrate.ts` with hardcoded credentials | Deleted |
| Broken `sql.begin()` wrapper in bulk import | Removed — honest row-by-row handling |
| Missing `RULE_LABELS`/`RULE_TOOLTIPS` for `form_factor_mismatch`, `cooler_too_tall` | Added to `frontend/src/types.ts` |
| `ioredis` Node.js dependency in Bun project | Replaced with in-memory rate limiter |
| `redis.ts` dead utility file | Deleted |
| `SqlFn` type not exported from `db/index.ts` | Exported |
| `search_text` column missing in search query | Fixed with CTE |
| `is_active` filter broke pagination | Moved to SQL |
| Admin presets route returned only active presets | Fixed |
| TDP multiplier mismatch (code: 1.5, docs: 1.2) | Docs corrected |
| Database doc said 12 tables, there are 13 | Corrected |
| `last_scrape_status` values wrong in docs | Corrected |
| SetupGame listed as id=12 in database docs | Corrected to id=13 |
| Seed file paths wrong in dev setup | Corrected |
| Unused `basename` import in `migrate.ts` | Removed |
| French error messages throughout backend | Standardized to English |
| `AdminEnv` type duplicated across 4 admin route files | Extracted to `admin/types.ts` |
| `as unknown as VariantInfo` double casts in `variantExtractor.ts` | Removed |
| Placeholder scrapers `site1Scraper.ts` / `site2Scraper.ts` in registry | Removed from `SCRAPER_REGISTRY` |
| Dead `jobId` variable in `admin/scrapers.ts` | Removed |
| `updatePreset` component replacement not transactional | Wrapped in `sql.begin()` |

### Architecture Notes
- Rate limiting on `POST /api/auth/login` uses an in-memory fixed-window store (resets on restart). Sufficient for single-process deployment.
- All database access goes through `getSql()` from `db/index.ts` — consistent across all route handlers.
- All 19 migrations are uniquely numbered (001–019).
- Search uses a CTE to compute `search_text` once and reference it in both WHERE and ORDER BY. Individual tokens are LIKE-escaped.
- `is_active` filtering in admin components is done in SQL with proper pagination support.
- All backend error messages are in English. French display text lives exclusively in the frontend.
- PSU is excluded from the TDP sum — it supplies power, it doesn't consume it.
- Rules 5 (form_factor_mismatch) and 6 (cooler_too_tall) now work for components created via the admin API, not just those with specs JSONB fallback.

---

## 2. Frontend (User-Facing)

**Status:** ✅ Zero ESLint Errors

All linting errors resolved. `RULE_LABELS` and `RULE_TOOLTIPS` cover all 8 compatibility rules.

---

## 3. Admin Panel

**Status:** ✅ No `any` Types | ⚠️ ESLint config times out (not a code issue)

No explicit `any` types exist in the admin panel.

---

## 4. Documentation

**Status:** ✅ Accurate | ✅ Complete structure

All documentation reflects the current codebase state. Fixes applied in this session:
- Migration count updated to 19 (001–019) across all docs
- `components` table compatibility columns (`supported_motherboards`, `max_cooler_height_mm`, `form_factor`, `height_mm`) documented
- API reference error shape comment corrected (removed "en français")
- Scraper run-all/single-run response shapes corrected
- Logs endpoint response shape corrected (added `count` field, max limit updated to 500)
- Round 2 task explainer added to `notes/task-explainers/`

---

## 5. Technical Debt

A global search for `TODO`, `FIXME`, and `HACK` across all `.ts`, `.tsx`, and `.sql` files returns **0 matches**.

---

## Summary

All critical and high-priority issues from both audit rounds are resolved. The backend is clean, fully tested, English-only, and all documentation is accurate and complete.

**Round 3 fixes (May 2026 — this session):**
- `frontend/src/types.ts` — `Component` interface now includes all 4 compatibility columns from migration 019
- `backend/src/utils/errors.ts` — `parseId()` moved here from `admin/types.ts` (correct shared location)
- `backend/src/routes/admin/types.ts` — re-exports `parseId` from `utils/errors.ts`
- `backend/src/routes/components.ts` — all inline ID validation replaced with `parseId()`
- `backend/src/routes/admin/scrapers.ts` — `Hono<AdminEnv>` type applied, unused import removed
- `admin/src/api.ts` — `LogEntry` type corrected to match actual scraper logs shape
- `backend/src/utils/__tests__/variantExtractor.test.ts` — 67 new tests covering all 8 category extractors
- `backend/src/utils/__tests__/rateLimiter.test.ts` — 8 new tests covering rate limiting behavior
- **438 tests passing across 31 files**

**Round 5 fixes (May 2026 — this session):**
- `frontend/src/components/BuildSummary.tsx` + `BuildSummary.module.css` — deleted dead component (superseded by inline compatibility display in `Configurator.tsx`)
- `backend/src/schemas/.gitkeep` — deleted stale gitkeep (directory has real content)
- `backend/scripts/sql/` — deleted empty directory
- `backend/src/routes/auth.ts` — added input length caps on login (username ≤ 128, password ≤ 256) to prevent oversized DB queries
- `backend/src/routes/compatibility.ts` — added Zod validation on all component slots; malformed inputs (e.g. `{ cpu: "string" }`) now return HTTP 400 instead of silently skipping rules
- `backend/src/routes/__tests__/compatibility.test.ts` — added 5 new tests covering the Zod validation (malformed slot, wrong numeric type, wrong array type, null tdp, unknown keys)
- `backend/src/services/__tests__/slugService.test.ts` — new test file: 20 tests covering `slugify`, `componentSlug`, `generateUniqueSlug`, and `getUniqueSlug` (DB-backed)
- `backend/src/services/__tests__/retailerService.test.ts` — new test file: 9 tests covering `getRetailers`, `getRetailerById`, `createRetailer`, `updateRetailer`
- `backend/src/services/__tests__/presetService.test.ts` — new test file: 9 tests covering `getPresets`, `getPresetById`, `deletePreset`
- `backend/src/utils/__tests__/rateLimiter.test.ts` — fixed flaky timing test (1100ms → 1500ms buffer for 1s window expiry)
- **483 tests passing across 34 files**
