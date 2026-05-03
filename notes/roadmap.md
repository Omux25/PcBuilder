# Project Roadmap

> **Status: Complete** — all phases done, tests passing, recent enhancements added.

---

## Current state (May 2, 2026)

| Area | Status |
|---|---|
| Backend API (all routes) | ✅ Done |
| Compatibility engine (7 rules) | ✅ Done |
| Scraping system (3 real retailers) | ✅ Done |
| DNA-based component matcher | ✅ Done |
| Variant model (prices per product URL) | ✅ Done |
| React frontend (configurator, detail page) | ✅ Done |
| Admin panel (separate Vite app) | ✅ Done |
| Deployment setup (Docker + nginx) | ✅ Done |
| Post-launch fixes & Enhancements | ✅ Done |

---

## What was built, phase by phase

### Phase 1 — Backend foundation

Database migrations 001–005, Zod schemas, JWT middleware, compatibility engine, component service.

### Phase 2 — Public API routes

`GET /api/components`, `GET /api/components/:id`, `GET /api/components/:id/prices`, `POST /api/compatibility/validate`.

### Phase 3 — Admin API routes

`POST/PUT/DELETE /api/admin/components`, `GET /api/admin/logs`.

### Phase 4 — App wiring

All routes mounted in `app.ts`, global error handler, `server.ts` entry point.

### Phase 5 — Scraping system

Structured logger, abstract base scraper, site1/site2 placeholder scrapers, aggregator (UPSERT prices), scheduler (Bun.cron every 24h).

### Phase 6 — React frontend

Configurator (7 slots), BuildSummary (TDP + errors), PriceComparison table, responsive layout.

### Phase 7 — Integration

Frontend connected to backend API, integration tests, edge case tests.

### Phase 8 — Expansion

Migrations 006–013, 305+ component catalog, updated services (priceHistory, retailer, preset, admin, slug), auth refresh tokens, new routes (slug lookup, price history, health, smart search), admin routes (dashboard, retailers, scrapers, unmatched), admin panel (Login, Dashboard, Components, BulkImport, Retailers, Scrapers, Unmatched), Dockerfile + docker-compose + nginx.

### Phase 9 — Real scrapers + DNA matcher

UltraPC scraper (279 mapped products), NextLevel scraper, SetupGame scraper, DNA-based component matcher (`componentMatcher.ts`), variant extractor (`variantExtractor.ts`), migration 014 (variant model), aggregator v2 (groups variants, UltraPC stock check), auto-mapping scripts, precision/recall evaluation tooling.

### Phase 10 — Feature Enhancements (Late April 2026)
- **Compare System Overhaul:** Added global state, UI tray, 1v1 head-to-head format, duel analysis, performance summary, and external benchmark links.
- **Market Trends:** Renamed from price drops, added price hike tracking, enhanced price drop realism, and added a global stock visibility toggle.
- **Technical Debt Resolved:** Fixed backend TypeScript errors (in `variantExtractor` and `unmatched` router) and resolved critical React Hooks violations in the frontend.

### Post-launch fixes

All critical and high-priority issues from the improvement report resolved:

| Issue | Fix |
|---|---|
| Slug route missing | Added `GET /api/components/slug/:slug` |
| Cooling schema missing | Added `coolingSchema` to `componentSchemas.ts` |
| LIKE wildcard injection | Escape `%` and `_` before LIKE query |
| Components ordered by id | Changed to `ORDER BY name ASC` |
| No CORS | Added `hono/cors` middleware |
| No rate limiting on login | In-memory rate limiter (10 req/min per IP) |
| PriceComparison key={i} | Changed to `key={offer.product_url}` |
| Emoji in UI | Removed all emoji from App.tsx, types.ts |
| aria-label missing | Added to ComponentPicker trigger button |
| Escape key on picker | Added keydown handler |
| BuildSummary debounce | Added 300ms debounce + AbortController |
| RULE_LABELS missing | Added to types.ts, used in BuildSummary |
| deleteComponent race | Fixed with atomic CTE — dependency check and DELETE in a single SQL statement |
| Promise.all in dashboard | Changed to Promise.allSettled |
| Dynamic import in scrapers | Replaced with static import |

### Phase 11 — Codebase Audit Round 2 (May 2026)

- Fixed compatibility Rules 5 & 6 silently dead: added `height_mm`, `supported_motherboards`, `max_cooler_height_mm` to schemas + migration 019
- Fixed PSU TDP incorrectly included in `total_tdp` sum
- Fixed `createPreset` not transactional — wrapped in `sql.begin()`
- Fixed LIKE token injection: individual search tokens now escaped
- Extracted `parseId()` helper to eliminate duplicated ID validation across admin routes
- Merged duplicate `getPriceHistory` SQL queries into one nullable-param query
- Deleted `site1Scraper.ts` / `site2Scraper.ts` placeholder files and their tests
- Deleted stale `.gitkeep` files in routes and middleware directories

### Phase 12 — Codebase Audit Round 3 (May 2026)

- Merged duplicate `getRetailers()` SQL queries into one nullable-param query
- Bulk import coercion now covers `max_cooler_height_mm`, `height_mm`, `benchmark_score` (migration 019 fields)
- Removed `case` from TDP sum in compatibility engine (passive enclosure, no power draw)
- Deleted remaining stale `.gitkeep` files in `scraper/scrapers/` and `scraper/utils/`
- Fixed architecture guide migration count (`001–018` → `001–019`)
- Replaced manual cookie regex in `auth.ts` with Hono's `getCookie()` helper
- Deleted unused Vite boilerplate assets (`react.svg`, `vite.svg`) from frontend and admin
- Moved `ScraperLog` interface to top of `admin/logs.ts`
- Replaced dynamic `import('./api')` in `App.tsx` with static import
- Replaced `ScraperInstance` index-signature interface in `session.ts` with typed `run` function references
- Added clarifying comments to `docker-compose.yml` and `adminService.ts`

### Phase 13 — Codebase Audit Round 5 (May 2026)

- Deleted dead `BuildSummary.tsx` component and its CSS module (superseded by inline display in `Configurator.tsx`)
- Deleted stale `backend/src/schemas/.gitkeep` and empty `backend/scripts/sql/` directory
- Added input length caps to login route (username ≤ 128, password ≤ 256)
- Added Zod validation to `POST /api/compatibility/validate` — malformed component slots now return HTTP 400
- Added 38 new tests: `slugService` (20), `retailerService` (9), `presetService` (9), compatibility Zod validation (5)
- Fixed flaky rate limiter timing test (1100ms → 1500ms buffer)

### Phase 14 — Codebase Audit Round 7 (May 2026)

- Injectable clock in `rateLimiter.ts` (`setNow`/`resetRateLimiter`) — eliminates timing-sensitive test flakiness; rewrote test to use fake time
- `presets.ts` now uses `parseId()` — consistent with all other routes
- Removed unnecessary `setSql`/`resetSql` re-exports from `componentService.ts` and `presetService.ts`; all test imports updated to use `db/index.ts` directly
- `dashboard.ts` auth middleware moved to `router.use('/*', ...)` — consistent with all other admin routers
- `marketTrends.ts` NaN guard: non-numeric `?days=` or `?limit=` params now fall back to defaults instead of passing `NaN` to SQL
- Bulk import now coerces `supported_motherboards` from pipe-separated CSV strings (same as `supported_ram_types`)
- Pinned `zod`, `undici`, `papaparse` to exact versions in `package.json`
- `notes/reference/database.md` intro verified: 12 application tables (confirmed by counting all `CREATE TABLE` statements across migrations 001–019)
- `notes/reference/api.md` bulk import response shape corrected: added `total_rows`, `errors` is now array of objects

### Phase 15 — Codebase Audit Round 8 (May 2026)

- Fixed 4 wrong return types in `admin/src/api.ts`: `getAdminLogs`, `getUnmatchedListings`, `runAllScrapers`, `runScraper` — all now match actual backend response shapes; removed unused `PaginatedResponse<T>` generic
- Removed defensive workarounds in `Scrapers.tsx` and `Unmatched.tsx` that masked the type mismatches
- Removed redundant `setSql`/`resetSql` re-exports from `adminService.ts`, `priceHistoryService.ts`, `retailerService.ts`, `slugService.ts`; updated all 6 affected test files to import from `db/index.ts` directly
- Removed duplicate UltraPC DDR4 category URL (`37-memoire-vive-ddr4`) — kept only parent `35-memoire-vive-pc`; eliminates redundant HTTP requests and double-scraping of DDR4 products
- Fixed footer retailer links in `frontend/src/App.tsx` — changed non-clickable `<span>` elements to real `<a>` tags pointing to retailer websites
- Deleted empty `packages/` directory (leftover from unused monorepo setup)
- Deleted raw AI chat log files from `.kiro/specs/gemini/`

### Phase 16 — Codebase Audit Round 9 (May 2026)

- Fixed smart-search price query scope: was fetching prices for all components in a category, now scoped to only the IDs returned by the search using `= ANY(ARRAY[...]::int[])`
- Added pagination to `GET /api/admin/unmatched-listings`: replaced hardcoded `LIMIT 200` with `page`/`limit` params (default 50, max 200), `COUNT(*) OVER()` for total, and `X-Total-Count` response header
- Added `components_by_category` to the shared `DashboardData` type — was computed by the backend but missing from the type definition
- Removed `any` type from `shared/api-client.ts` — replaced with `unknown` and proper type narrowing
- Capped `?ids=` batch lookup at 50 IDs to prevent unbounded DB queries
- Wrapped refresh token rotation in a transaction (`sql.begin()`) — prevents session loss if server crashes between DELETE and INSERT
- Removed dead `specs` fallback in `extractComponentFields` — all fields are at the top level per the Zod schemas; the `specs` JSONB is for display only
- Migrated `scheduler.ts` to use `getSql()` from the DI layer instead of importing `bunSql` directly — consistent with all other files
- Added detailed comment to `aggregator.ts` explaining why the dual `bunSql`/`getSql()` pattern exists (Bun.sql array parameter limitation)
- Added clarifying comment to `DELETE /api/admin/retailers/:id` explaining it is a soft-delete
- Updated `notes/reference/api.md`: unmatched listings pagination params, dashboard response includes `components_by_category`

---

### Phase 17 — Optional Polish (May 2026)

- Removed vestigial `component_id` field from `ScrapedPrice` interface — it was always set to `0` by all scrapers and immediately overwritten by the aggregator from `scraper_mappings`. The type now only contains fields that are actually used.
- Created `apps/frontend/src/ui-strings.ts` — centralized all user-facing French strings (nav labels, hero text, build actions, configurator labels, picker filters, footer) into a single typed `UI` constant. Updated `App.tsx`, `Configurator.tsx`, and `ComponentPicker.tsx` to use it.
- Added frontend test suite (`bun test`) — 28 tests across 4 files covering `buildUrl` (encode/decode/localStorage), `buildUtils` (price calculation), `theme` (module structure), and `ui-strings` (constant completeness). Added `test` script to `apps/frontend/package.json` and `@shared/*` path resolution to `tsconfig.json`.
- Total test count: 608 (580 backend + 28 frontend), all passing.

### Phase 18 — Full UI String Centralization (May 2026)

- Completed the UI string centralization started in Phase 17: all remaining French strings in pages and components now use `UI` constants from `ui-strings.ts`
- Files updated: `CategoryBrowse.tsx`, `ComponentDetail.tsx`, `ComponentsIndex.tsx`, `Compare.tsx`, `GlobalSearch.tsx`, `MarketTrends.tsx`, `Presets.tsx`, `PriceComparison.tsx`, `InlinePrices.tsx`, `PriceHistoryChart.tsx`, `CompareTray.tsx`, `ErrorBoundary.tsx`
- `ui-strings.ts` now covers every user-facing French string in the entire frontend — nav, hero, build actions, configurator, picker, browse, detail, compare, search, trends, presets, price panels, error boundary
- 608 tests passing (580 backend + 28 frontend), 0 TypeScript diagnostics

### Phase 19 — Codebase Audit Round 10 (May 2026)

- Removed dead `CompatibilityError` and `CompatibilityWarning` interfaces from `frontend/src/types.ts` — both were unused duplicates of `CompatibilityIssue` already exported from `shared/types.ts`
- Fixed all stale "13 tables" references across docs — the correct count is 12 (verified by `CREATE TABLE` count across all migrations); root cause was a wrong Phase 14 roadmap entry that said `"12 tables" → "13 tables"`
- Updated `notes/reference/database.md` intro with explicit numbered list of all 12 tables and a guard note for future agents
- Updated `notes/reference/dev-setup.md` test count: `550 pass, 39 files` → `578 pass, 41 files`
- Fixed `notes/glossary.md`: `ScrapedPrice` entry corrected (`product_name` → `name`, removed stale `component_id` mention); `Migration` entry: `001–018` → `001–019`
- Fixed `notes/guide/architecture.md`: `parseId()` import path clarified (imported from `admin/types.ts`, defined in `errors.ts`)
- Fixed `notes/README.md`: compatibility engine link `8 rules` → `7 rules`
- Fixed `notes/features/scraping-system.md`: `ScrapedPrice` code block removed stale `component_id` field
- Fixed `notes/features/admin-panel.md`: bulk import section removed non-existent "resolve slug conflicts" UI step
- Fixed `notes/reference/api.md`: `?ids=` param now documents the 50-ID cap and 400 error
- Fixed `notes/guide/database.md`: added `benchmark_score` to cpu/gpu optional columns; `13 tables` → `12 tables`
- Fixed `notes/guide/concepts.md`: clarified that 6 rules are declarative in `RULES` array, `psu_underpowered` is a separate calculated check

### Phase 21 — Codebase Audit Round 12 (May 2026)

- Fixed Dockerfile: changed `WORKDIR` to `/app/apps/backend` and added `COPY shared/ /app/shared/` — `@shared/*` path alias (`../../shared/*` in tsconfig) now resolves correctly inside the container; previously Docker builds would start but fail at runtime with "Cannot find module '@shared/*'"
- Fixed `Configurator.tsx`: replaced 4 hardcoded French strings (`"Composant"`, `"Sélection"`, `"Meilleur prix"`, `"Retirer"`) with `UI.configurator.*` constants
- Fixed `App.tsx`: replaced hardcoded theme toggle `aria-label` strings with `UI.app.themeLight` / `UI.app.themeDark`
- Added `thComponent`, `thSelection`, `thBestPrice`, `removeTitle` to `UI.configurator` in `ui-strings.ts`
- Added `themeLight`, `themeDark` to `UI.app` in `ui-strings.ts`
- Added startup fail-fast in `server.ts`: server now exits with a clear error if `JWT_SECRET` is missing or shorter than 32 characters, instead of silently serving a broken API
- Fixed `notes/features/scraping-system.md`: `ScrapedPrice` code block corrected — field is `product_name?` (optional), not `name`
- Fixed `notes/glossary.md`: `ScrapedPrice` entry corrected — field is `product_name` not `name`
- Fixed `notes/roadmap.md`: removed stale "Presets page deferred" note — `Presets.tsx` has existed since Phase 8
- Strengthened `docker-compose.yml` CORS warning comment
- Added explanatory comment to `smart-search` route documenting the 300-component cap and its rationale
- Deleted unused `hero.png` from both `apps/frontend/src/assets/` and `apps/admin/src/assets/` — identical files, neither imported anywhere in either app
- Added 19 unit tests for `catalogBuilder.ts` (`scraper/__tests__/catalogBuilder.test.ts`) — covers all 8 categories, DNA deduplication, skipping accessories/bundles/laptop RAM, progress callback, and slug uniqueness
- Populated `.vscode/settings.json` — was empty; now sets TypeScript SDK path, format-on-save, trim trailing whitespace, and final newline rules
- Total tests: 599 backend + 28 frontend = 627

---

### Phase 20 — Codebase Audit Round 11 (May 2026)

- Moved `compatibilityService.test.ts` from `src/__tests__/` to `src/services/__tests__/` — consistent with project convention (tests live next to the code they test)
- Added `routes/__tests__/health.test.ts` — closes the only gap in route test coverage
- Fixed `README.md`: stale test count (550 → 608), stale table count (13 → 12), stale rule count (8 → 7)
- Fixed `notes/reference/dev-setup.md`: stale test count (578 → 608)
- Fixed `notes/roadmap.md`: moved "What's left" section to end of document — phases now read in strict chronological order

---

## What's left (optional)

- Redis-backed rate limiting for production (current in-memory limiter resets on server restart — acceptable for single-process deployment)

---

## Phase 23 — Full Codebase Audit & Admin Panel Overhaul (May 2026)

### Backend fixes
- Fixed `getComponentsByIds` Bun.sql `IN ${ids}` array bug — replaced with `sql.unsafe()` integer literals
- Fixed smart-search `ANY($1::int[])` Bun.sql array bug — same fix
- Fixed scraper session never updating `last_scrape_at` / `last_scrape_status` on retailers table
- Added `DELETE /api/admin/retailers/:id/hard` — permanent hard delete with cascade (prices, mappings, logs)
- Fixed integration tests: replaced hardcoded `retailer_id=1` with `retailer_id=10` (UltraPC) after retailers 1–9 were deleted

### Admin panel fixes
- Fixed blank white page — `import type` errors in `api.ts` and `shared/component-utils.ts` (`verbatimModuleSyntax`)
- Fixed component status toggle sending invalid payload (caused "Error" alert)
- Fixed retailers flicker on toggle — optimistic UI update (no full reload)
- Fixed `ComponentModal` missing category-specific required fields (socket, wattage, length_mm, etc.)
- Fixed `ScraperLog.site` type mismatch in `Scrapers.tsx`
- Added retailer hard delete button (only shown for inactive retailers)
- Scrapers page: live log polling every 3s while scraper is running, animated spinner, auto-scroll to top
- Unmatched listings: full pagination, real total count, retailer filter, explanatory subtitle

### Scraper architecture
- Extracted `RETAILER_SCRAPERS` config to `scraper/config/retailers.config.ts` — single source of truth
- `session.ts` reads from config; adding a new retailer = one config entry, no session.ts changes
- Standardized all log messages: `[SESSION]`, `[RetailerName]`, `[AGGREGATOR]`, `[AUTO-MAPPER]`, `[CATALOG]`, `[SCHEDULER]` prefixes
- Aggregator errors now routed to DB logger (visible in admin logs panel)
- Added `product_description` to `ScrapedPrice` — scrapers populate it from listing card specs
- `extractGpuVariant` uses description as fallback for VRAM when not in product name
- VRAM regex extended: now matches `24G`, `24Go`, `24GDDR6` in addition to `24GB`

### Frontend fixes
- Compare page: fixed 3 slots showing instead of 2 (removed spurious `canAddMore` column)
- Out-of-stock offers collapsed by default in `InlinePrices`, `PriceComparison`, `ComponentDetail`
- Toggle shows "Voir N offres épuisées" / "Masquer les épuisées"

### Infrastructure
- Vite 8 → 6.3.5 downgrade (Rolldown incompatible with Bun 1.3.13)
- Removed `workspaces` from root `package.json` (was corrupting backend node_modules on install)
- `dev.ps1` restored to original (port-kill attempts caused CRLF/reserved-variable errors)
- 599 backend + 28 frontend = 627 tests, all passing
