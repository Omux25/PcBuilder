# Project Roadmap

> **Status: Complete** — all phases done, 324 tests passing.

---

## Current state (April 28, 2026)

| Area | Status |
|---|---|
| Backend API (all routes) | ✅ Done |
| Compatibility engine (6 rules) | ✅ Done |
| Scraping system (3 real retailers) | ✅ Done |
| DNA-based component matcher | ✅ Done |
| Variant model (prices per product URL) | ✅ Done |
| React frontend (configurator, detail page) | ✅ Done |
| Admin panel (separate Vite app) | ✅ Done |
| Deployment setup (Docker + nginx) | ✅ Done |
| Post-launch fixes (improvement report) | ✅ Done |

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
| deleteComponent race | Wrapped in transaction |
| Promise.all in dashboard | Changed to Promise.allSettled |
| Dynamic import in scrapers | Replaced with static import |

---

## What's left (optional)

- Property-based tests for slug uniqueness, pagination correctness, price history insertion (marked optional in spec)
- Presets page in the frontend (deferred — needs more scraper data first)
- Redis-backed rate limiting for production (current in-memory limiter resets on server restart)
- Hashed refresh tokens (current implementation stores UUID directly)
