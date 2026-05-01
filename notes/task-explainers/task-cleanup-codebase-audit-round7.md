# Codebase Cleanup — Audit Round 7

**What was built:** 12 issues identified in a fresh full-codebase audit were fixed — covering a flaky test, inconsistent patterns, a runtime NaN bug, a missing CSV coercion, doc inaccuracies, and dependency pinning.

---

## Issues Fixed

### 1. Flaky rate limiter test — replaced real sleep with injectable clock

**Problem:** `isRateLimited > resets after the window expires` used `setTimeout(resolve, 2000)` to wait for a 1-second window to expire. Under load this occasionally ran in 2008ms and failed.

**Fix:** Added `setNow()` and `resetRateLimiter()` exports to `rateLimiter.ts` so tests can inject a fake clock. The test now advances `fakeNow` by 60,001ms instead of sleeping — zero real time, zero flakiness. Added a new test `does not reset before the window expires` to cover the boundary.

**Files changed:**
- `backend/src/utils/rateLimiter.ts` — added `_getNow`, `setNow()`, `resetRateLimiter()`; all `Date.now()` calls replaced with `_getNow()`
- `backend/src/utils/__tests__/rateLimiter.test.ts` — rewrote to use fake clock; added 1 new test (9 total, was 8)

---

### 2. `presets.ts` inline ID validation — replaced with `parseId()`

**Problem:** `GET /api/builds/presets/:id` used inline `Number(raw)` + `Number.isInteger()` check instead of the shared `parseId()` helper from `utils/errors.ts`. Every other route uses `parseId()`.

**Fix:** Import `parseId` and use it.

**Files changed:**
- `backend/src/routes/presets.ts`

---

### 3 & 4. Unnecessary `setSql`/`resetSql` re-exports removed from services

**Problem:** `componentService.ts` and `presetService.ts` re-exported `setSql`/`resetSql` from `db/index.ts`. This created a confusing second import path for the same thing. The canonical source is `db/index.ts`.

**Fix:** Removed the re-exports from both services. Updated all test files that imported from the services to import from `db/index.ts` directly.

**Files changed:**
- `backend/src/services/componentService.ts` — removed re-export
- `backend/src/services/presetService.ts` — removed re-export
- `backend/src/routes/__tests__/components.test.ts` — import from `db/index.js`
- `backend/src/routes/admin/__tests__/components.test.ts` — import from `db/index.js`
- `backend/src/routes/admin/__tests__/presets.test.ts` — import from `db/index.js`
- `backend/src/services/__tests__/componentService.test.ts` — import from `db/index.js`
- `backend/src/services/__tests__/presetService.test.ts` — import from `db/index.js`
- `backend/src/__tests__/pbt/pagination.pbt.test.ts` — import from `db/index.js`
- `backend/src/__tests__/pbt/prices.pbt.test.ts` — import from `db/index.js`

---

### 5. `database.md` intro said "12 tables" — corrected to 13

**Problem:** The intro line read "All 12 application tables" but there are 13 (the doc itself lists 12 numbered tables plus `preset_build_components` documented under Table 8).

**Fix:** Changed "12" to "13".

**Files changed:**
- `notes/reference/database.md`

---

### 6. `api.md` bulk import response shape was wrong

**Problem:** The docs showed:
```json
{ "imported": 45, "skipped": 2, "failed": 1, "errors": ["Row 12: ..."] }
```
The actual response from `admin/components.ts` is:
```json
{ "total_rows": 48, "imported": 45, "skipped": 2, "failed": 1, "errors": [{ "row": 12, "message": "..." }] }
```
Missing `total_rows`, and `errors` is an array of objects not strings.

**Fix:** Updated the response example to match the actual code.

**Files changed:**
- `notes/reference/api.md`

---

### 7. `dashboard.ts` auth middleware applied inline instead of via `.use()`

**Problem:** `adminDashboardRouter.get('/', authMiddleware, async (c) => {...})` applied auth as a route-level argument. Every other admin router uses `router.use('/*', authMiddleware)` at the top. Inconsistent pattern — if a second route were added to this file, it would be unprotected by default.

**Fix:** Moved `authMiddleware` to `adminDashboardRouter.use('/*', authMiddleware)`.

**Files changed:**
- `backend/src/routes/admin/dashboard.ts`

---

### 8. `marketTrends.ts` — NaN silently passed to SQL on bad query params

**Problem:** `Number('abc')` returns `NaN`. `Math.min(30, Math.max(1, NaN))` returns `NaN`. The SQL query then received `NaN` as the `days` or `limit` parameter with no validation error returned to the client.

**Fix:** Added `Number.isFinite()` guards — falls back to the default value (7 for days, 20 for limit) when the parsed value is not finite.

```typescript
const daysRaw  = Number(c.req.query('days')  ?? 7);
const days     = Math.min(30, Math.max(1, Number.isFinite(daysRaw) ? daysRaw : 7));
```

**Files changed:**
- `backend/src/routes/marketTrends.ts`

---

### 9. Bulk import missing `supported_motherboards` coercion

**Problem:** CSV values are strings. The bulk import coerced `supported_ram_types` from pipe-separated strings (`"DDR4|DDR5"` → `["DDR4", "DDR5"]`) but did NOT do the same for `supported_motherboards` (added in migration 019). Importing a case component with `supported_motherboards` from CSV would fail Zod validation silently.

**Fix:** Added the same pipe-split coercion for `supported_motherboards`.

**Files changed:**
- `backend/src/routes/admin/components.ts`

---

### 10. Pinned open-range dependencies in `package.json`

**Problem:** `zod`, `undici`, and `papaparse` used `^` version ranges, which can pull in breaking minor/patch updates. Project rules require pinned versions.

**Fix:** Removed `^` from all three.

**Files changed:**
- `backend/package.json`

---

## Test Results

**548 tests passing across 39 files. 0 failures.**

The previously flaky `resets after the window expires` test now passes deterministically on every run.
