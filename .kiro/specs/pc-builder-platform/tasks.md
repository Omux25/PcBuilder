# Implementation Plan: PC Builder Web Platform (Morocco)

## Overview

Incremental implementation of the full-stack PC Builder platform: PostgreSQL database, Bun/Hono backend (REST API, compatibility engine, JWT auth), cheerio+undici scraping system, and React.js frontend. Backend runs on Bun inside WSL2. Each task builds on the previous one, ending with full integration.

## Tasks

- [x] 1. Initialize project structure and database
  - Create `backend/` and `frontend/` directory scaffolding as defined in the design
  - Initialize `package.json` for backend with dependencies: `hono`, `zod`, `jsonwebtoken`, `bcrypt`, `cheerio`, `undici` (Bun built-ins handle SQL, cron, testing)
  - DB access via `Bun.sql` (built-in) — no `pg` pool needed
  - Write SQL migration scripts in `backend/src/db/migrations/` for all five tables: `components`, `retailers`, `prices`, `scraper_logs`, `admins`
  - Add recommended indexes to the migration scripts
  - _Requirements: 8.1, 11.1_

- [x] 2. Implement the Compatibility Engine
  - [x] 2.1 Implement `compatibilityService.js` with all six compatibility rules
    - CPU/Motherboard socket check → `socket_mismatch` error
    - RAM type check → `ram_type_mismatch` error
    - RAM frequency check → `ram_frequency_exceeded` warning
    - GPU/Case clearance check → `gpu_too_long` error
    - Total TDP calculation: sum of all component TDPs
    - Recommended PSU wattage: `Math.ceil(total_tdp * 1.2)`
    - Underpowered PSU check → `psu_underpowered` warning
    - Return the full output shape defined in the design (compatible, total_tdp, recommended_psu_wattage, errors, warnings)
    - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.3, 4.1, 4.2, 5.1, 5.2, 5.3_

  - [ ]* 2.2 Write property test — Property 1: CPU/Motherboard socket consistency
    - **Property 1: CPU/Motherboard socket consistency**
    - **Validates: Requirements 2.1, 2.2**
    - Use `fast-check` with `numRuns: 100`; assert `(cpu.socket !== motherboard.socket) === hasSocketError`

  - [ ]* 2.3 Write property test — Property 2: RAM type/Motherboard consistency
    - **Property 2: RAM type/Motherboard consistency**
    - **Validates: Requirements 3.1, 3.2**
    - Use `fast-check`; assert `!motherboard.supported_ram_types.includes(ram.ram_type) === hasRamError`

  - [ ]* 2.4 Write property test — Property 3: RAM frequency exceeded warning
    - **Property 3: RAM frequency exceeded warning**
    - **Validates: Requirements 3.3**
    - Use `fast-check`; assert `(ram.frequency_mhz > motherboard.max_ram_frequency) === hasWarning`

  - [ ]* 2.5 Write property test — Property 4: Total TDP and PSU recommendation
    - **Property 4: Total TDP and PSU recommendation**
    - **Validates: Requirements 5.1, 5.2**
    - Use `fast-check`; assert `total_tdp === sum(tdps)` and `recommended_psu_wattage === Math.ceil(total_tdp * 1.2)`

  - [ ]* 2.6 Write property test — Property 5: Underpowered PSU warning
    - **Property 5: Underpowered PSU warning**
    - **Validates: Requirements 5.3**
    - Use `fast-check`; assert `(psu.wattage < recommendedWattage) === hasWarning`

  - [ ]* 2.7 Write property test — Property 6: GPU/Case clearance
    - **Property 6: GPU/Case clearance**
    - **Validates: Requirements 4.1, 4.2**
    - Use `fast-check`; assert `(gpu.length_mm > pcCase.max_gpu_length_mm) === hasError`

- [x] 3. Checkpoint — Ensure all compatibility engine tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement Zod validation schemas and middleware
  - Create `backend/src/schemas/componentSchemas.js` with Zod schemas for each component category (cpu, motherboard, gpu, ram, storage, psu, case), enforcing required fields per category
  - Create `backend/src/middleware/validate.js` that applies the appropriate Zod schema to the request body and returns HTTP 400 with field-level error details on failure
  - _Requirements: 8.2, 8.3, 11.2_

- [x] 5. Implement JWT authentication middleware and auth route
  - Create `backend/src/middleware/auth.js` that verifies the `Authorization: Bearer <token>` header using `jsonwebtoken`; return HTTP 401 if the token is absent, malformed, or expired
  - Create `backend/src/routes/auth.js` exposing `POST /api/auth/login`: validate credentials against the `admins` table (bcrypt compare), return a signed JWT on success
  - _Requirements: 11.3, 11.4_

  - [ ]* 5.1 Write property test — Property 9: Admin endpoints require valid JWT
    - **Property 9: Admin endpoints require valid JWT**
    - **Validates: Requirements 11.3, 11.4**
    - Use `fast-check`; for each admin endpoint, assert that any request without a valid JWT returns HTTP 401

- [ ] 6. Implement public API routes
  - [x] 6.1 Create `backend/src/services/componentService.js`
    - `getComponents(filters)`: query `components` with optional `category`, `socket`, `ram_type` filters using parameterized queries
    - `getComponentById(id)`: return a single component or throw `COMPONENT_NOT_FOUND`
    - `getPricesByComponentId(id)`: query `prices JOIN retailers` ordered by ascending price
    - _Requirements: 1.2, 7.1, 7.3, 11.1_

  - [ ]* 6.2 Write property test — Property 7: Price offers sorted ascending
    - **Property 7: Price offers sorted ascending**
    - **Validates: Requirements 7.1**
    - Use `fast-check`; assert that for every index `i < j`, `offers[i].price <= offers[j].price`

  - [ ] 6.3 Create `backend/src/routes/components.js`
    - `GET /api/components` — list with optional query filters
    - `GET /api/components/:id` — component detail
    - Wire to `componentService.js`
    - _Requirements: 1.2, 8.4_

  - [ ] 6.4 Create `backend/src/routes/prices.js`
    - `GET /api/components/:id/prices` — price offers sorted ascending
    - Return `last_updated` per offer; return empty array with a message if no offers exist
    - _Requirements: 7.1, 7.3, 7.4_

  - [ ] 6.5 Create `backend/src/routes/compatibility.js`
    - `POST /api/compatibility/validate` — parse body, call `compatibilityService.js`, return full result
    - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.3, 4.1, 4.2, 5.1, 5.2, 5.3_

- [ ] 7. Implement admin API routes
  - [ ] 7.1 Create `backend/src/routes/admin/components.js` (JWT-protected)
    - `POST /api/admin/components` — validate with Zod schema, insert component
    - `PUT /api/admin/components/:id` — validate, update component
    - `DELETE /api/admin/components/:id` — delete component (cascade handled by DB)
    - _Requirements: 8.1, 8.2, 8.3_

  - [ ]* 7.2 Write property test — Property 8: Required field validation returns HTTP 400
    - **Property 8: Required field validation returns HTTP 400**
    - **Validates: Requirements 8.2, 8.3, 11.2**
    - Use `fast-check`; for any component payload missing a required field, assert the API returns HTTP 400

  - [ ] 7.3 Create `backend/src/routes/admin/logs.js` (JWT-protected)
    - `GET /api/admin/logs` — query `scraper_logs` with optional `date`, `site`, `level` filters
    - _Requirements: 8.4, 9.3_

  - [ ]* 7.4 Write property test — Property 11: Log filtering returns only matching entries
    - **Property 11: Log filtering returns only matching entries**
    - **Validates: Requirements 9.3**
    - Use `fast-check`; assert every returned log entry satisfies all provided filter criteria

- [ ] 8. Wire Hono app and global error handling
  - Create `backend/src/app.ts`: register all routes, attach `validate.ts` and `auth.ts` middlewares where required
  - Implement global error-handling returning the standard `{ error: { code, message, fields? } }` JSON shape
  - Create `backend/src/server.ts` as the entry point using `Bun.serve()`
  - _Requirements: 8.3, 11.1, 11.2_

- [ ] 9. Checkpoint — Ensure all backend API tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Implement the scraping system
  - [ ] 10.1 Create `backend/scraper/utils/logger.ts`
    - Structured logger that writes entries to `scraper_logs` via `Bun.sql` (level, site, message, created_at)
    - _Requirements: 9.1, 9.2_

  - [ ] 10.2 Create `backend/scraper/scrapers/baseScraper.ts`
    - Abstract base class using `undici` for HTTP requests and `cheerio` for HTML parsing
    - Contract: `async scrape(): Promise<ScrapedPrice[]>`
    - _Requirements: 6.1_

  - [ ] 10.3 Create `backend/scraper/scrapers/site1Scraper.ts` and `site2Scraper.ts`
    - Extend `BaseScraper`; use `undici` fetch + `cheerio` to extract price, stock, and `product_url` per `component_id`
    - Each scraper targets a known component via explicit `component_id` mapping
    - _Requirements: 6.1, 6.5_

  - [ ] 10.4 Create `backend/scraper/aggregator.ts`
    - UPSERT into `prices` via `Bun.sql` (update `price`, `in_stock`, `product_url`, `last_updated` on conflict `component_id + retailer_id`)
    - INSERT summary `INFO` log at end of session (components updated count, error count)
    - _Requirements: 6.2, 6.3, 6.5_

  - [ ] 10.5 Create `backend/scraper/scheduler.ts`
    - Use `Bun.cron()` to trigger the full scraping session every 24 hours
    - Run each scraper inside a `try/catch`; on error, log to `scraper_logs` with `level = 'ERROR'` and continue
    - Log session start and end with `level = 'INFO'`
    - _Requirements: 6.2, 6.4, 9.1, 9.2_

  - [ ]* 10.6 Write property test — Property 10: Scraper error isolation
    - **Property 10: Scraper error isolation**
    - **Validates: Requirements 6.4, 9.2**
    - Use `fast-check`; for any mix of succeeding/failing mock scrapers, assert that the number of ERROR log entries equals the number of failing scrapers and all others complete

- [ ] 11. Checkpoint — Ensure all scraper tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 12. Implement the React.js frontend
  - [ ] 12.1 Initialize the React app with TypeScript support
    - Set up project with Vite (or Create React App); install dependencies
    - Define TypeScript interfaces: `BuildConfiguration`, `CompatibilityResult`, `CompatibilityIssue`, `PriceOffer`, `Component`
    - _Requirements: 1.1, 12.1_

  - [ ] 12.2 Implement the Configurator component
    - Render the seven component category slots (CPU, Motherboard, GPU, RAM, Storage, PSU, Case)
    - On category click, fetch `GET /api/components?category=<cat>` and display the component list
    - On component select, add to `BuildConfiguration` state and call `POST /api/compatibility/validate`
    - On component remove, update state and re-validate
    - Add a "Reset build" button that clears `BuildConfiguration`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [ ] 12.3 Implement the Build Summary panel
    - Display selected components and the current `CompatibilityResult`
    - Show `total_tdp` and `recommended_psu_wattage` permanently
    - Visually highlight incompatible components (errors) and warnings
    - Display compatibility alerts in a visible, accessible manner on both mobile and desktop
    - _Requirements: 2.3, 5.4, 12.3_

  - [ ] 12.4 Implement the Component Detail / Price Comparison page
    - Fetch `GET /api/components/:id/prices` and render offers sorted by ascending price
    - Display retailer name, price (MAD), stock availability, and `last_updated`
    - Each offer links to `product_url` opening in a new tab
    - Show a "not available" message when the offers list is empty
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [ ] 12.5 Implement responsive layout
    - Apply CSS/media queries so the layout is usable between 320px and 2560px
    - Adapt navigation, component lists, and build summary for mobile and desktop breakpoints
    - _Requirements: 12.1, 12.2_

- [ ] 13. Checkpoint — Ensure all frontend unit tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 14. Integration and final wiring
  - [ ] 14.1 Connect frontend to backend API
    - Configure the API base URL (env variable); verify all fetch calls match the REST endpoints defined in the design
    - _Requirements: 1.2, 2.1, 5.1, 7.1_

  - [ ] 14.2 Write integration tests for the scraping cycle
    - Mock a local HTML test site; run the full scraping session; assert prices are UPSERTED correctly and logs are recorded
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [ ] 14.3 Write unit tests for edge cases across all layers
    - Component not found → HTTP 404
    - Expired JWT → HTTP 401
    - DB constraint violation → HTTP 400
    - No price offers → empty array with message
    - _Requirements: 7.4, 8.3, 11.3, 11.4_

- [ ] 15. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- **Runtime:** Bun 1.3+ inside WSL2 — use `bun test` (built-in), `Bun.sql` (built-in), `Bun.cron()` (built-in)
- Property tests use `fast-check` with `numRuns: 100` minimum
- Unit tests use `bun test` (Jest-compatible); frontend tests use Vitest + React Testing Library
- Checkpoints ensure incremental validation at each major layer boundary
- The scraper uses explicit `component_id` mapping — no fuzzy product name matching needed at runtime
- All source files use TypeScript (`.ts`) — Bun handles transpilation natively, no build step needed
