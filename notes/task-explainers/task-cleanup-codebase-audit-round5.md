# Task — Codebase Cleanup: Audit Round 5 (May 2026)

**What was built:** A fifth audit pass that fixed 6 issues: a dead frontend component, stale artifacts, security hardening on the login route, Zod validation on the compatibility endpoint, and 38 new tests.

**Why:** After four rounds of cleanup, this pass focused on the remaining gaps: a superseded React component that was never deleted, missing input validation on the login route, and test coverage gaps in the service layer.

---

## What was fixed

### 1. Dead `BuildSummary.tsx` component deleted

**Problem:** `BuildSummary.tsx` and its CSS module were superseded when the build summary display was moved inline into `Configurator.tsx`. The old component file remained in the codebase but was never imported anywhere.

**Fix:** Deleted `BuildSummary.tsx` and `BuildSummary.module.css`.

**Files deleted:**
- `frontend/src/components/BuildSummary.tsx`
- `frontend/src/components/BuildSummary.module.css`

---

### 2. Stale `.gitkeep` and empty `sql/` directory deleted

**Problem:** `backend/src/schemas/.gitkeep` was left over from when the schemas directory was first created. `backend/scripts/sql/` was an empty directory with no content.

**Fix:** Deleted both.

**Files deleted:**
- `backend/src/schemas/.gitkeep`
- `backend/scripts/sql/` (empty directory)

---

### 3. Login route input length caps added

**Problem:** The `POST /api/auth/login` route accepted username and password of arbitrary length. An attacker could send a multi-megabyte password string, forcing bcrypt to hash it (bcrypt is intentionally slow), causing a denial-of-service.

**Fix:** Added length validation: username ≤ 128 characters, password ≤ 256 characters. Requests exceeding these limits return HTTP 400 before bcrypt is called.

**Files changed:**
- `backend/src/routes/auth.ts`

---

### 4. Zod validation added to `POST /api/compatibility/validate`

**Problem:** The compatibility endpoint accepted any JSON body and passed it directly to `validateCompatibility()`. Malformed input (e.g. a component slot that is a string instead of an object) would cause a runtime error or silently produce wrong results instead of returning a clean HTTP 400.

**Fix:** Added a Zod schema that validates each component slot is either absent or a plain object. Invalid slots now return HTTP 400 with a descriptive error.

**Files changed:**
- `backend/src/routes/compatibility.ts`

---

### 5. 38 new tests added

**Problem:** Several service modules had no dedicated test coverage: `slugService`, `retailerService`, `presetService`, and the new compatibility Zod validation.

**Fix:** Added 38 tests across 4 test files:
- `slugService.test.ts` — 20 tests covering slug generation, collision handling, and edge cases
- `retailerService.test.ts` — 9 tests covering CRUD operations and filtering
- `presetService.test.ts` — 9 tests covering preset creation, retrieval, and the transaction guarantee
- `compatibility.test.ts` — 5 tests covering the new Zod validation (valid input, missing fields, wrong types)

**Files added:**
- `backend/src/services/__tests__/slugService.test.ts`
- `backend/src/services/__tests__/retailerService.test.ts`
- `backend/src/services/__tests__/presetService.test.ts`
- `backend/src/routes/__tests__/compatibility.test.ts` (extended)

---

### 6. Flaky rate limiter timing test fixed

**Problem:** The rate limiter test used a 1100ms buffer to wait for the 1-minute window to reset. On slow CI machines, 1100ms was occasionally not enough, causing the test to fail intermittently.

**Fix:** Increased the buffer to 1500ms.

**Files changed:**
- `backend/src/utils/__tests__/rateLimiter.test.ts`

---

## Tests

All tests pass after these changes. The total test count increased from ~324 to ~362 with the 38 new tests added.
