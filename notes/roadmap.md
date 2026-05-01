# Project Roadmap

> **Status: Complete** — all phases done, tests passing, recent enhancements added.

---

## Current state (May 1, 2026)

| Area | Status |
|---|---|
| Backend API (all routes) | ✅ Done |
| Compatibility engine (8 rules) | ✅ Done |
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

---

## What's left (optional)

- Presets page in the frontend (deferred — needs more scraper data first)
- Redis-backed rate limiting for production (current in-memory limiter resets on server restart — acceptable for single-process deployment)
