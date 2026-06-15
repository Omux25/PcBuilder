# Backend Codemap

**Freshness Timestamp:** 2026-06-15T16:10:00Z

## Core Layout
The backend runs on Bun using Hono framework.

- `src/server.ts`: Entry point. Pre-warms the database connection pool, starts Bun.serve(), and coordinates graceful shutdown.
- `src/app.ts`: Mounts public and protected Hono subrouters, sets up CORS rules, handles global error processing and serves static folders.
- `src/core/`: Essential subsystems (database connection `db/index.ts`, migrations utility `db/migrate.ts`, standard errors definitions).
- `src/modules/`: Component-focused domain logic:
  - `auth/`: Admin auth, JWT verification, and cookie refresh token rotations.
  - `catalog/`: Components search/retrieval, merchant details repository, and prices list.
  - `builds/`: 
    - `presetService.ts` / `presetController.ts`: Ready-to-go preset configurations.
    - `compatibilityService.ts` / `compatibilityController.ts`: Client configuration validator matching board form factor, sockets, etc.
    - `controllers/shareController.ts`: DB-backed URL shortener, JSON retrieve logic, and static OpenGraph redirect page compiler.
  - `scraping/`: Cron scheduling engine, spider tasks, parsing, and keyword matching.

## Route Maps
- `POST /api/builds/share`: Save a slot-to-component configuration map and returns a short ID.
- `GET /api/builds/share/:id`: Retrieve saved JSON build.
- `GET /b/:id` & `GET /share/:id`: Return HTML metadata redirect response for social media rich previews (OpenGraph).
- `GET /api/admin/unmatched-listings/grouped`: Retrieve grouped unmatched listings with category search, filtering, and sorting support.
- `POST /api/admin/unmatched-listings/bulk-confirm-categories`: Bulk confirm and ingest high-confidence matches, optionally scoped to a single category.
- `POST /api/admin/unmatched-listings/bulk-associate`: Bulk link high-confidence matches to existing components.
- `POST /api/admin/unmatched-listings/create-and-link`: Create new component from unmatched listings and link them.
- `/api/compatibility/validate`: Compatibility engine verification request.
- `/api/components/smart-search`: Advanced catalog sorting filtered by current selected parts.
