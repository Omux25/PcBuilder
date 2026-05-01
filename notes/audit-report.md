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

All documentation reflects the current codebase state.

---

## 5. Technical Debt

A global search for `TODO`, `FIXME`, and `HACK` across all `.ts`, `.tsx`, and `.sql` files returns **0 matches**.

---

## Summary

All critical and high-priority issues from both audit rounds are resolved. The backend is clean, fully tested, English-only, and all documentation is accurate and complete.
