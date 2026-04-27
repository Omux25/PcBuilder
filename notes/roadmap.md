# Project Roadmap

> **Status: Complete** — all phases done, 185 tests passing.

Tasks marked `*` are optional — skip them for a faster MVP.

---

## Progress Overview

| Phase | Status |
|---|---|
| Backend foundation (DB, schemas, middleware, auth) | ✅ Done |
| Compatibility engine | ✅ Done |
| Component service (data access) | ✅ Done |
| Public API routes | ✅ Done |
| Admin API routes | ✅ Done |
| App wiring (app.ts + server.ts) | ✅ Done |
| Scraping system | ✅ Done |
| React frontend | ✅ Done |
| Integration & final tests | ✅ Done |

---

## Phase 1 — Backend Foundation ✅

| Task | What | Files | Status |
|---|---|---|---|
| 1 | Project scaffolding + DB migrations | `package.json`, `tsconfig.json`, `migrations/001–005` | ✅ Done |
| 2.1 | Compatibility engine — 6 rules | `compatibilityService.ts` | ✅ Done |
| 3 | Checkpoint — compatibility tests pass | — | ✅ Done |
| 4 | Zod schemas + validation middleware | `componentSchemas.ts`, `middleware/validate.ts` | ✅ Done |
| 5 | JWT middleware + auth login route | `middleware/auth.ts`, `routes/auth.ts` | ✅ Done |
| 6.1 | Component service (DB queries) | `services/componentService.ts` | ✅ Done |

---

## Phase 2 — Public API Routes 🔄

| Task | What | Files | Status |
|---|---|---|---|
| 6.3 | `GET /api/components` + `GET /api/components/:id` | `routes/components.ts` | ✅ Done |
| **6.4** | `GET /api/components/:id/prices` | `routes/prices.ts` | ✅ Done |
| 6.5 | `POST /api/compatibility/validate` | `routes/compatibility.ts` | ✅ Done |
| 6.2 `*` | Property test — price offers sorted ascending | test file | ⏸ skipped |

---

## Phase 3 — Admin API Routes ⏳

| Task | What | Files | Status |
|---|---|---|---|
| 7.1 | `POST/PUT/DELETE /api/admin/components` (JWT-protected) | `routes/admin/components.ts` | ✅ Done |
| **7.3** | `GET /api/admin/logs` (JWT-protected) | `routes/admin/logs.ts` | ✅ Done |
| 7.2 `*` | Property test — required field validation → HTTP 400 | test file | ⏸ skipped |
| 7.4 `*` | Property test — log filtering returns only matching entries | test file | ⏸ skipped |

---

## Phase 4 — App Wiring ⏳

| Task | What | Files | Status |
|---|---|---|---|
| 8 | Wire all routes into Hono app + global error handler + server entry point | `app.ts`, `server.ts` | ✅ Done |
| 9 | Checkpoint — all backend API tests pass | — | ✅ Done |

---

## Phase 5 — Scraping System ⏳

| Task | What | Files | Status |
|---|---|---|---|
| 10.1 | Structured logger → `scraper_logs` table | `scraper/utils/logger.ts` | ✅ Done |
| 10.2 | Abstract base scraper (undici + cheerio) | `scraper/scrapers/baseScraper.ts` | ✅ Done |
| 10.3 | Site-specific scrapers | `scraper/scrapers/site1Scraper.ts`, `site2Scraper.ts` | ✅ Done |
| 10.4 | Aggregator — UPSERT prices into DB | `scraper/aggregator.ts` | ✅ Done |
| 10.5 | Scheduler — `Bun.cron()` every 24h | `scraper/scheduler.ts` | ✅ Done |
| 11 | Checkpoint — all scraper tests pass | — | ✅ Done |
| 10.6 `*` | Property test — scraper error isolation | test file | ⏸ skipped |

---

## Phase 6 — React Frontend ⏳

| Task | What | Files | Status |
|---|---|---|---|
| 12.1 | Init React + Vite + TypeScript interfaces | `frontend/` | ✅ Done |
| 12.2 | Configurator component (7 slots, select, validate) | `frontend/src/components/Configurator` | ✅ Done |
| 12.3 | Build Summary panel (TDP, errors, warnings) | `frontend/src/components/BuildSummary` | ✅ Done |
| 12.4 | Price Comparison page | `frontend/src/pages/PriceComparison` | ✅ Done |
| 12.5 | Responsive layout (320px–2560px) | CSS/media queries | ✅ Done |
| 13 | Checkpoint — all frontend tests pass | — | ✅ Done |

---

## Phase 7 — Integration ⏳

| Task | What | Status |
|---|---|---|
| 14.1 | Connect frontend to backend API (env var base URL) | ✅ Done |
| 14.2 | Integration tests — full scraping cycle | ✅ Done |
| 14.3 | Edge case tests (404, 401, empty prices, DB constraint) | ✅ Done |
| 15 | Final checkpoint — all tests pass | ✅ Done |

---

## Optional property tests — all implemented

| Task | Property | Validates | Status |
|---|---|---|---|
| 2.2 | CPU/Motherboard socket consistency | Requirements 2.1, 2.2 | ✅ Done |
| 2.3 | RAM type/Motherboard consistency | Requirements 3.1, 3.2 | ✅ Done |
| 2.4 | RAM frequency exceeded warning | Requirement 3.3 | ✅ Done |
| 2.5 | Total TDP + PSU recommendation | Requirements 5.1, 5.2 | ✅ Done |
| 2.6 | Underpowered PSU warning | Requirement 5.3 | ✅ Done |
| 2.7 | GPU/Case clearance | Requirements 4.1, 4.2 | ✅ Done |
| 5.1 | Admin endpoints require valid JWT | Requirements 11.3, 11.4 | ✅ Done |
| 6.2 | Price offers sorted ascending | Requirement 7.1 | ✅ Done |
| 7.2 | Required field validation → HTTP 400 | Requirements 8.2, 8.3 | ✅ Done |
| 7.4 | Log filtering returns only matching entries | Requirement 9.3 | ✅ Done |
| 10.6 | Scraper error isolation | Requirements 6.4, 9.2 | ✅ Done |
