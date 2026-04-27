# Improvement Report — PC Builder Maroc

This document catalogues every issue found across the full codebase after reviewing all files written during the expansion phase. Items are grouped by severity and area. Each entry states what is wrong, why it matters, and what the fix is.

---

## Critical Issues (breaks functionality)

### 1. ComponentDetail page uses wrong slug lookup strategy

**File:** `frontend/src/pages/ComponentDetail.tsx`

**Problem:** The page fetches components with `search: slug` and then does a `.find()` on the result. This is fragile — if the slug contains common words, the search may return a different component first, or the slug may not appear in the first 20 results at all.

**Fix:** Add a dedicated `GET /api/components/slug/:slug` route on the backend that calls `getComponentBySlug()` directly. Update `api.ts` to use it. The current `getComponentBySlug()` function already exists in `componentService.ts` — it just has no route wired to it.

---

### 2. `getComponentBySlug` in `api.ts` calls a non-existent endpoint

**File:** `frontend/src/api.ts`, line 63

**Problem:** `getComponentBySlug(slug)` calls `/components/slug/${slug}` which does not exist in `app.ts` or `routes/components.ts`. This function is currently unused in the frontend but will break if called.

**Fix:** Either wire the route (see issue 1 above) or remove the function until the route exists.

---

### 3. `getPrices` in `api.ts` expects `{ offers: PriceOffer[] }` but the backend returns `{ offers: PriceOffer[] }` only sometimes

**File:** `frontend/src/api.ts`, line 72 and `backend/src/routes/prices.ts`

**Problem:** The prices route returns `{ offers: [], message: '...' }` when empty, but `{ offers: [...] }` when populated. The frontend destructures `data.offers` in both cases, which works, but the `message` field is silently discarded. The `PriceComparison` component already handles the empty case visually, so this is not a crash — but the inconsistency is a maintenance hazard.

**Fix:** Standardize the prices response to always return `{ offers: PriceOffer[], message?: string }` and update the frontend to optionally display the message.

---

### 4. `componentSchemas.ts` has no schema for `cooling` category

**File:** `backend/src/schemas/componentSchemas.ts`

**Problem:** The database and seed data include a `cooling` category with 14 components, but `componentSchemas` only covers 7 categories. Any attempt to create or validate a cooling component via the admin API will fail with an unhandled category error.

**Fix:** Add a `coolingSchema` with fields `tdp` (optional) and extend `componentSchemas` and `ComponentCategory` type to include `'cooling'`.

---

### 5. `getComponents` query uses `LIKE` with unescaped user input

**File:** `backend/src/services/componentService.ts`, lines 80-85

**Problem:** The search filter builds `LIKE '%' || ${search} || '%'` directly. If the user types `%` or `_`, these are treated as SQL wildcards, producing unexpected results. While Bun.sql parameterizes the value (preventing injection), the wildcard characters still affect query behavior.

**Fix:** Escape `%` and `_` in the search term before passing it to the query: `search.replace(/%/g, '\\%').replace(/_/g, '\\_')` and add `ESCAPE '\\'` to the LIKE clause.

---

### 6. `CATEGORY_ICONS` in `types.ts` uses emoji characters

**File:** `frontend/src/types.ts`, lines 75-84

**Problem:** Emoji are used as category icons throughout the UI (ComponentPicker, ComponentDetail hero, Presets page use case labels). This was explicitly prohibited. They also render inconsistently across operating systems and are not accessible to screen readers without aria-label.

**Fix:** Replace all emoji with SVG icons or text abbreviations. Remove `CATEGORY_ICONS` from `types.ts` and create a proper `CategoryIcon` React component using inline SVG or a lightweight icon library (e.g. `lucide-react`). Also remove emoji from `USE_CASE_LABELS` in `Presets.tsx` and the logo in `App.tsx`.

---

### 7. `App.tsx` logo contains an emoji

**File:** `frontend/src/App.tsx`, line 43

**Problem:** `🖥 PC Builder` — emoji in the site logo, violating the no-emoji rule.

**Fix:** Remove the emoji. Use text only or an SVG logo.

---

## High Priority Issues (degrades quality significantly)

### 8. `getComponents` query orders by `id ASC` — not useful for users

**File:** `backend/src/services/componentService.ts`, line 87

**Problem:** Components are returned in insertion order. Users searching for "Ryzen" will get results in whatever order they were seeded, not by relevance or name. This makes the ComponentPicker feel random.

**Fix:** Order by `name ASC` by default. Add an optional `sort` parameter (`name`, `brand`, `release_year`) with a direction parameter.

---

### 9. `BuildSummary` fires a validation API call on every single build change with no debounce

**File:** `frontend/src/components/BuildSummary.tsx`, lines 27-36

**Problem:** Every time a component is added or removed, `validateBuild()` is called immediately. If a user is quickly selecting components, this fires multiple concurrent requests. The last response to arrive wins, which may not be the most recent request.

**Fix:** Add a 300ms debounce on the `useEffect` that calls `validateBuild`, and cancel in-flight requests using `AbortController`.

---

### 10. `PriceComparison` component is disconnected from the Configurator flow

**File:** `frontend/src/App.tsx`, lines 52-68

**Problem:** The price comparison panel requires the user to manually click a component name button to see prices. This is an extra step that most users will not discover. The panel also shows nothing until a button is clicked, making the right column feel empty.

**Fix:** Auto-select the first selected component for price comparison. When a new component is added to the build, automatically show its prices. The manual override buttons can remain for switching between components.

---

### 11. `ComponentDetail` fetches component by searching, not by slug — causes N+1 pattern

**File:** `frontend/src/pages/ComponentDetail.tsx`, lines 28-42

**Problem:** The page calls `getComponents({ search: slug, limit: 1 })` which runs a full-text search query, then filters client-side. This is slow and unreliable. See issue 1 for the root cause.

**Fix:** Same as issue 1 — add a slug route on the backend.

---

### 12. `deleteComponent` makes 3 sequential SQL queries without a transaction

**File:** `backend/src/services/componentService.ts`, lines 270-300

**Problem:** The dependency checks (count prices, count mappings) and the DELETE are three separate queries. Between the count check and the DELETE, another request could insert a new price record, making the check stale. This is a TOCTOU (time-of-check-time-of-use) race condition.

**Fix:** Wrap the three queries in a single transaction, or use a single query with a conditional DELETE and check the result.

---

### 13. `createComponent` and `updateComponent` accept `Record<string, unknown>` — no type safety

**File:** `backend/src/services/componentService.ts`, lines 155, 210

**Problem:** Both functions take `data: Record<string, unknown>` and destructure it with manual casts. If the Zod validation middleware is bypassed or a new field is added, there is no compile-time safety. The casts like `${name as string}` hide potential runtime errors.

**Fix:** Define a typed `CreateComponentInput` interface that mirrors the validated Zod output. Use it as the parameter type for both functions.

---

### 14. `adminService.ts` uses `Promise.all` for dashboard stats but does not handle partial failures

**File:** `backend/src/services/adminService.ts`, lines 75-95

**Problem:** `getDashboardStats()` uses `Promise.all` across 5 queries. If any single query fails (e.g. a new table does not exist yet), the entire dashboard request fails with a 500 error. The admin sees nothing instead of partial data.

**Fix:** Use `Promise.allSettled` and return `null` for any stat that failed, with an error flag in the response so the frontend can show a partial dashboard with error indicators.

---

### 15. `Presets.tsx` still contains emoji in `USE_CASE_LABELS`

**File:** `frontend/src/pages/Presets.tsx`, lines 14-19

**Problem:** `'gaming': '🎮 Gaming'` etc. — emoji in use case labels, violating the no-emoji rule.

**Fix:** Remove emoji. Use plain text labels: `'gaming': 'Gaming'`, `'workstation': 'Workstation'`, etc.

---

## Medium Priority Issues (reduces usability or maintainability)

### 16. `ComponentPicker` closes on outside click but not on Escape key

**File:** `frontend/src/components/ComponentPicker.tsx`

**Problem:** Standard dropdown accessibility requires the Escape key to close the dropdown and return focus to the trigger button. Without this, keyboard users cannot dismiss the picker.

**Fix:** Add a `keydown` event listener inside the dropdown that calls `setOpen(false)` on `Escape` and moves focus back to the trigger button.

---

### 17. `ComponentPicker` has no `aria-label` on the trigger button

**File:** `frontend/src/components/ComponentPicker.tsx`, line 80

**Problem:** The trigger button has `aria-expanded` and `aria-haspopup` but no `aria-label`. Screen readers will announce the button content (which includes the icon character) without context about which category it controls.

**Fix:** Add `aria-label={`Sélectionner ${CATEGORY_LABELS[category]}`}` to the trigger button.

---

### 18. `PriceHistoryChart` groups by date string but does not handle timezone differences

**File:** `frontend/src/components/PriceHistoryChart.tsx`, line 44

**Problem:** `entry.recorded_at.slice(0, 10)` extracts the date in UTC. If the server is in UTC+0 and the user is in UTC+1, a price recorded at 23:30 UTC appears on the previous day in the chart. This causes gaps and misaligned data points.

**Fix:** Parse `recorded_at` as a Date object and use `toLocaleDateString()` for grouping, or ensure the backend returns dates in the user's timezone.

---

### 19. `getComponents` in `componentService.ts` passes `null` values as typed parameters in Bun.sql

**File:** `backend/src/services/componentService.ts`, lines 72-88

**Problem:** The query uses `${category ?? null}::text IS NULL` pattern repeated 5 times. This works but is verbose and hard to read. More importantly, passing the same parameter twice (`${category ?? null}` appears twice per condition) means Bun.sql may bind it as two separate parameters, which is wasteful.

**Fix:** Refactor to build the query dynamically using a query builder pattern, or extract the filter logic into a helper that constructs a WHERE clause string with a separate parameters array.

---

### 20. `seed_catalog.sql` has a duplicate RAM entry

**File:** `backend/seed_catalog.sql`

**Problem:** `gskill-ripjaws-v-16gb-ddr4-3200` appears twice in the RAM section (lines ~180 and ~195). The second insert is silently skipped by `ON CONFLICT DO NOTHING`, but it indicates the seed data was not reviewed carefully.

**Fix:** Remove the duplicate entry.

---

### 21. `backfill_slugs.ts` is in the backend root — should be in a scripts directory

**File:** `backend/backfill_slugs.ts`

**Problem:** One-off scripts mixed with source files create confusion about what is production code and what is a utility.

**Fix:** Move to `backend/scripts/backfill_slugs.ts` and add a `scripts` entry in `package.json`.

---

### 22. `adminScrapersRouter` imports `runScrapingSession` dynamically at request time

**File:** `backend/src/routes/admin/scrapers.ts`, lines 35 and 65

**Problem:** `await import('../../../scraper/scheduler.js')` is called inside the request handler. Dynamic imports at request time add latency and can fail silently if the module path is wrong. The import also pulls in the entire scheduler module including the `Bun.cron()` call, which may register a duplicate cron job.

**Fix:** Import `runScrapingSession` statically at the top of the file. Separate the cron registration from the session function so importing the module does not start the scheduler.

---

### 23. `auth.ts` refresh token is a UUID — not cryptographically strong enough for a 7-day token

**File:** `backend/src/routes/auth.ts`, line 97

**Problem:** `randomUUID()` produces a UUID v4 which is 122 bits of randomness. This is acceptable but not ideal for a long-lived token. More importantly, the token is stored as plain text in the database — if the `refresh_tokens` table is compromised, all sessions are immediately hijackable.

**Fix:** Use `crypto.getRandomValues` to generate 32 bytes of random data and encode as hex (256 bits). Store a bcrypt hash of the token in the database, not the raw value. On refresh, compare the submitted token against the stored hash.

---

### 24. No CORS configuration in `app.ts`

**File:** `backend/src/app.ts`

**Problem:** The backend has no CORS headers. In production, if the frontend is served from a different origin than the API, all requests will be blocked by the browser. Hono has a built-in CORS middleware.

**Fix:** Add `import { cors } from 'hono/cors'` and configure it with the allowed origins from an environment variable: `app.use('*', cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') ?? '*' }))`.

---

### 25. No rate limiting on the auth login endpoint

**File:** `backend/src/routes/auth.ts`

**Problem:** `POST /api/auth/login` has no rate limiting. An attacker can attempt unlimited password guesses. bcrypt slows individual attempts but does not prevent automated attacks.

**Fix:** Add a simple in-memory rate limiter (e.g. max 10 attempts per IP per minute) using a Map. For production, use a Redis-backed solution.

---

## Low Priority Issues (polish and consistency)

### 26. `index.css` defines CSS variables but component CSS files use hardcoded hex values

**File:** `frontend/src/index.css` vs `frontend/src/components/ComponentPicker.module.css` etc.

**Problem:** `index.css` defines `--bg`, `--surface`, `--border`, `--accent` etc., but the new component CSS files written during the expansion use hardcoded values like `#1e1e2e`, `#313244`, `#89b4fa`. This means the two systems are inconsistent — changing the theme requires editing both the variables and the hardcoded values.

**Fix:** Rewrite all new CSS module files to use the CSS variables from `index.css`. Align the variable names (the existing variables use a different color palette than the hardcoded values in the new files).

---

### 27. `BuildSummary` shows raw rule names like `socket_mismatch` to users

**File:** `frontend/src/components/BuildSummary.tsx`, line 68

**Problem:** The `rule` field from the API (e.g. `socket_mismatch`, `ram_type_mismatch`) is displayed directly in the UI. These are internal identifiers, not user-facing labels.

**Fix:** Add a `RULE_LABELS` map in `types.ts` that maps rule codes to human-readable French labels. Use it in `BuildSummary` to display the label instead of the raw code.

---

### 28. `ComponentDetail` hero section uses `CATEGORY_ICONS` which contains emoji

**File:** `frontend/src/pages/ComponentDetail.tsx`, line 68

**Problem:** Same as issue 6 — emoji in the hero icon. Also, the icon is inside a `div` with no `aria-hidden="true"`, so screen readers will attempt to read the emoji character.

**Fix:** Replace with an SVG icon component. Add `aria-hidden="true"` to any decorative icon element.

---

### 29. `Presets.tsx` `incompleteBadge` uses a warning emoji

**File:** `frontend/src/pages/Presets.tsx`, line 88

**Problem:** `⚠ Incomplet` — emoji in a badge, violating the no-emoji rule.

**Fix:** Use a plain text indicator or an SVG warning icon with `aria-hidden="true"`.

---

### 30. `PriceComparison` uses `key={i}` (array index) for table rows

**File:** `frontend/src/components/PriceComparison.tsx`, line 68

**Problem:** Using array index as React key causes incorrect reconciliation if the offers list changes order (e.g. after a price update). The cheapest offer may change, and React will reuse the wrong DOM node.

**Fix:** Use `offer.retailer_id` as the key, which is stable and unique per row.

---

### 31. `componentService.ts` `getComponents` orders by `id ASC` — duplicated note from issue 8

This is the same as issue 8. Noted here for completeness in the service layer.

---

### 32. No loading skeleton or placeholder in `ComponentPicker` while fetching

**File:** `frontend/src/components/ComponentPicker.tsx`

**Problem:** While components are loading, the dropdown shows a plain text "Chargement..." message. This causes layout shift when results appear.

**Fix:** Add a skeleton loader (3-4 placeholder rows with a shimmer animation) to maintain stable layout during loading.

---

### 33. `seed_presets.sql` uses hardcoded component IDs in comments but subqueries by slug

**File:** `backend/seed_presets.sql`

**Problem:** The comments say `-- AMD Ryzen 5 5600` but the actual query uses slug-based subqueries. This is fine, but the office build has no GPU slot, which is intentional but undocumented. If someone runs the seed on a fresh database where slugs differ, the preset will silently have fewer components than expected.

**Fix:** Add a comment explaining that the office build intentionally has no GPU. Add a verification query at the end of the file that counts expected components per preset.

---

## Summary Table

| # | Area | Severity | Action |
|---|---|---|---|
| 1 | Backend / Frontend | Critical | Add `GET /api/components/slug/:slug` route |
| 2 | Frontend | Critical | Remove or fix `getComponentBySlug` in api.ts |
| 3 | Backend / Frontend | Critical | Standardize prices response shape |
| 4 | Backend | Critical | Add `cooling` schema to `componentSchemas.ts` |
| 5 | Backend | Critical | Escape LIKE wildcards in search filter |
| 6 | Frontend | Critical | Remove all emoji, replace with SVG icons |
| 7 | Frontend | Critical | Remove emoji from App.tsx logo |
| 8 | Backend | High | Order components by name ASC by default |
| 9 | Frontend | High | Debounce `validateBuild` calls in BuildSummary |
| 10 | Frontend | High | Auto-select first component for price comparison |
| 11 | Frontend | High | Fix ComponentDetail slug lookup (same as 1) |
| 12 | Backend | High | Wrap deleteComponent in a transaction |
| 13 | Backend | High | Type createComponent/updateComponent inputs properly |
| 14 | Backend | High | Use Promise.allSettled in getDashboardStats |
| 15 | Frontend | High | Remove emoji from Presets.tsx use case labels |
| 16 | Frontend | Medium | Add Escape key handler to ComponentPicker |
| 17 | Frontend | Medium | Add aria-label to ComponentPicker trigger |
| 18 | Frontend | Medium | Fix timezone handling in PriceHistoryChart |
| 19 | Backend | Medium | Refactor getComponents filter query |
| 20 | Backend | Medium | Remove duplicate RAM entry in seed_catalog.sql |
| 21 | Backend | Medium | Move backfill_slugs.ts to scripts/ directory |
| 22 | Backend | Medium | Fix dynamic import in adminScrapersRouter |
| 23 | Backend | Medium | Hash refresh tokens before storing |
| 24 | Backend | Medium | Add CORS middleware to app.ts |
| 25 | Backend | Medium | Add rate limiting to login endpoint |
| 26 | Frontend | Low | Unify CSS variables vs hardcoded hex values |
| 27 | Frontend | Low | Map rule codes to French labels in BuildSummary |
| 28 | Frontend | Low | Fix emoji in ComponentDetail hero, add aria-hidden |
| 29 | Frontend | Low | Remove emoji from incomplete badge in Presets |
| 30 | Frontend | Low | Use retailer_id as key in PriceComparison rows |
| 32 | Frontend | Low | Add skeleton loader to ComponentPicker |
| 33 | Backend | Low | Document office preset has no GPU in seed file |
