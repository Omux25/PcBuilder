# PC Builder — Full Project Context
> Generated: April 28, 2026 | Status: Expansion phase complete, 319 tests passing

---

## 1. Project Identity

| Field | Value |
|---|---|
| Project name | PC Builder Maroc |
| Purpose | Price comparator + compatibility checker for PC components in Morocco |
| What it does NOT do | Sell anything — it redirects users to retailer websites |
| Team | Salmane ELHJOUJI (backend) · Ghali KHARMOUDY (frontend) |
| School | EMSI Orangers, Casablanca |
| Deadline | May 11, 2026 |
| Repository | https://github.com/Omux25/PcBuilder.git |
| Git identity | Salmane ELHJOUJI <omux25@gmail.com> |
| Default branch | main |

---

## 2. Tech Stack (Non-Negotiable)

| Layer | Technology | Version | Notes |
|---|---|---|---|
| Runtime | Bun (inside WSL2 Ubuntu) | 1.3+ | Path: `~/.bun/bin/bun` |
| Backend framework | Hono | 4.12.12 | NOT Express |
| Database | PostgreSQL | 16 | |
| DB client | Bun.sql (built-in) | — | NOT pg/node-postgres |
| Validation | Zod | 4.3.6 | |
| Auth | JWT + bcrypt | jsonwebtoken 9.0.2, bcrypt 6.0.0 | |
| Scraping | cheerio + undici | cheerio 1.0.0, undici 8.1.0 | NOT Crawlee |
| Scheduler | Bun.cron() (built-in) | — | NOT node-cron |
| Testing | bun test (built-in) | — | NOT Jest |
| Property testing | fast-check | 4.7.0 | |
| Language | TypeScript with ESM | ESNext | import/export only, never require |
| Frontend | React + Vite | React 19, Vite 8 | NOT Next.js |
| Admin panel | React + Vite | separate app in `admin/` | |

### WSL2 / Execution Environment
- WSL2 distro: `Ubuntu`
- Bun path: `~/.bun/bin/bun`
- Project path in WSL2: `/mnt/c/Headquarters/Projects/PcBuilder/`
- WSL2 sudo password: `2525`
- Run tests: `wsl -d Ubuntu -- bash -c "cd /mnt/c/Headquarters/Projects/PcBuilder/backend && ~/.bun/bin/bun test 2>&1"`
- Never run Bun directly in PowerShell — it is not installed on Windows
- Git push: use PowerShell with Windows git + gh credential helper

---

## 3. Overall Project Status

**319 tests passing, 0 failing** (as of April 28, 2026, across 26 test files)

### Phase completion

| Phase | Description | Status |
|---|---|---|
| 1 | Backend foundation (DB, schemas, middleware, auth) | ✅ Done |
| 2 | Public API routes | ✅ Done |
| 3 | Admin API routes | ✅ Done |
| 4 | App wiring (app.ts + server.ts) | ✅ Done |
| 5 | Scraping system | ✅ Done |
| 6 | React frontend (user-facing) | ✅ Done |
| 7 | Admin panel (React + Vite, separate app) | ✅ Done |
| 8 | Deployment setup (Docker, Nginx, .env) | ✅ Done |
| 9 | Integration & final tests | ✅ Done |
| 10 | Smart component matcher (DNA-based, Gemini-recommended) | ✅ Done |
| 13 | Optional property-based tests for expansion | ⏸ Skipped (marked optional with `*`) |

### Only remaining items
- Task 13.1, 13.2, 13.3 — optional property-based tests for slug uniqueness, pagination correctness, and price history insertion. All marked `*` (optional). Not blocking anything.

---

## 4. Repository File Structure

```
PcBuilder/
├── backend/                          ← Bun + Hono server (runs in WSL2)
│   ├── src/
│   │   ├── app.ts                    ← Hono app wiring, all routes mounted here
│   │   ├── server.ts                 ← Entry point — Bun.serve()
│   │   ├── db/
│   │   │   └── migrations/           ← 13 SQL migration files (001–013)
│   │   ├── middleware/
│   │   │   ├── auth.ts               ← JWT verification middleware
│   │   │   └── validate.ts           ← Zod request body validation middleware
│   │   ├── routes/
│   │   │   ├── auth.ts               ← POST /api/auth/login, /refresh, /logout
│   │   │   ├── components.ts         ← GET /api/components, /:id, /slug/:slug, /:id/price-history
│   │   │   ├── prices.ts             ← GET /api/components/:id/prices
│   │   │   ├── compatibility.ts      ← POST /api/compatibility/validate
│   │   │   ├── health.ts             ← GET /api/health
│   │   │   ├── presets.ts            ← GET /api/builds/presets
│   │   │   ├── smartSearch.ts        ← GET /api/components/smart-search
│   │   │   └── admin/
│   │   │       ├── components.ts     ← POST/PUT/DELETE /api/admin/components (+ bulk import)
│   │   │       ├── dashboard.ts      ← GET /api/admin/dashboard
│   │   │       ├── logs.ts           ← GET /api/admin/logs
│   │   │       ├── retailers.ts      ← CRUD /api/admin/retailers
│   │   │       ├── scrapers.ts       ← POST /api/admin/scrapers/:id/run, /run-all
│   │   │       ├── unmatched.ts      ← GET/POST /api/admin/unmatched-listings
│   │   │       └── presets.ts        ← CRUD /api/admin/presets
│   │   ├── services/
│   │   │   ├── compatibilityService.ts   ← 6 compatibility rules
│   │   │   ├── componentService.ts       ← All DB queries for components
│   │   │   ├── priceHistoryService.ts    ← Price history queries + recording
│   │   │   ├── retailerService.ts        ← Retailer CRUD
│   │   │   ├── presetService.ts          ← Preset builds CRUD
│   │   │   ├── adminService.ts           ← Dashboard stats, activity log
│   │   │   └── slugService.ts            ← Unique slug generation from DB
│   │   ├── schemas/
│   │   │   └── componentSchemas.ts       ← Zod schemas per category (7 categories)
│   │   └── utils/
│   │       ├── slugify.ts                ← slugify() + generateUniqueSlug()
│   │       └── componentMatcher.ts       ← DNA-based smart product matcher
│   ├── scraper/
│   │   ├── scrapers/
│   │   │   ├── baseScraper.ts            ← Abstract base with retry + exponential backoff
│   │   │   ├── site1Scraper.ts           ← Site 1 implementation
│   │   │   ├── site2Scraper.ts           ← Site 2 implementation
│   │   │   ├── nextlevelScraper.ts       ← NextLevel retailer scraper
│   │   │   ├── setupgameScraper.ts       ← SetupGame retailer scraper
│   │   │   └── ultrapcScraper.ts         ← UltraPC retailer scraper
│   │   ├── aggregator.ts                 ← UPSERT prices, scraper_mappings lookup, unmatched_listings
│   │   ├── scheduler.ts                  ← Bun.cron() per-retailer scheduling
│   │   └── session.ts                    ← Session management
│   ├── scripts/                          ← One-off utility scripts (not production code)
│   │   ├── auto_map_ultrapc.ts
│   │   ├── auto_map_nextlevel.ts
│   │   ├── auto_map_setupgame.ts
│   │   ├── remap_all.ts                  ← Runs all 3 mappers + price aggregation + coverage report
│   │   ├── backfill_slugs.ts             ← One-time slug backfill (run after migration 006)
│   │   ├── expand_catalog_from_unmatched.ts
│   │   ├── evaluate_matcher.ts
│   │   ├── shadow_run_matcher.ts
│   │   └── ... (other inspection/analysis scripts)
│   ├── seed_catalog.sql                  ← 150+ real-world components
│   ├── seed_catalog_v2.sql
│   ├── seed_retailers.sql                ← Moroccan/regional retailers
│   ├── seed_presets.sql                  ← 4 preset builds
│   ├── setup_db.sql
│   ├── Dockerfile                        ← oven/bun:1.3-alpine
│   ├── .env                              ← Local secrets (gitignored)
│   ├── .env.example                      ← Template with all required vars
│   └── package.json
│
├── admin/                                ← Separate React + Vite admin panel app
│   ├── src/
│   │   ├── api.ts                        ← Auth-aware fetch wrapper (attaches Bearer, handles 401)
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── components/
│   │   │   └── Layout.tsx                ← Admin shell layout
│   │   └── pages/
│   │       ├── Login.tsx                 ← /admin/login
│   │       ├── Dashboard.tsx             ← /admin/dashboard (stats, chart, activity feed)
│   │       ├── Components.tsx            ← /admin/components (list + CRUD)
│   │       ├── BulkImport.tsx            ← /admin/components/import
│   │       ├── Retailers.tsx             ← /admin/retailers
│   │       ├── Scrapers.tsx              ← /admin/scrapers (status + manual triggers)
│   │       ├── Unmatched.tsx             ← /admin/unmatched (link/dismiss queue)
│   │       └── Presets.tsx               ← /admin/presets
│   └── package.json
│
├── notes/                                ← Team documentation (committed to Git)
│   ├── README.md
│   ├── roadmap.md
│   ├── glossary.md
│   ├── improvement-report.md             ← 33 issues catalogued (critical → low)
│   ├── guide/
│   │   ├── architecture.md
│   │   ├── database.md
│   │   ├── stack.md
│   │   ├── concepts.md
│   │   ├── dev-setup.md
│   │   └── git-workflow.md
│   ├── diagrams/                         ← PlantUML source files (committed)
│   │   ├── use_case.puml
│   │   ├── class.puml
│   │   ├── activity.puml
│   │   ├── sequence_1_compatibility.puml
│   │   ├── sequence_2_price_comparison.puml
│   │   ├── sequence_3_admin.puml
│   │   └── sequence_scraping.puml
│   ├── spec/                             ← LaTeX source for Cahier des Charges
│   └── task-explainers/                  ← One .md per completed task (20 files)
│
├── docker-compose.yml                    ← postgres + backend + nginx
├── nginx.conf                            ← Reverse proxy config
└── .gitignore
```

---

## 5. Database Schema — All 13 Tables

### Migration files (run in order)
| File | Table(s) created/modified |
|---|---|
| 001_create_components.sql | `components` (original 7-category polymorphic table) |
| 002_create_retailers.sql | `retailers` |
| 003_create_prices.sql | `prices` |
| 004_create_scraper_logs.sql | `scraper_logs` |
| 005_create_admins.sql | `admins` |
| 006_expand_components.sql | ALTER `components` — adds slug, brand, description, specs (JSONB), image_url, release_year, is_active, created_at, updated_at + indexes |
| 007_expand_retailers.sql | ALTER `retailers` — adds logo_url, country, is_active, scraping_interval_hours, last_scrape_at, last_scrape_status, notes |
| 008_create_scraper_mappings.sql | `scraper_mappings` |
| 009_create_price_history.sql | `price_history` |
| 010_create_preset_builds.sql | `preset_builds` + `preset_build_components` |
| 011_create_unmatched_listings.sql | `unmatched_listings` |
| 012_create_admin_activity_log.sql | `admin_activity_log` |
| 013_create_refresh_tokens.sql | `refresh_tokens` |

### Table details

**`components`** — canonical catalog, polymorphic (all 8 categories in one table)
- `id`, `name`, `brand`, `category` (CHECK: cpu/motherboard/gpu/ram/storage/psu/case/cooling)
- `slug` UNIQUE — URL-safe identifier e.g. `amd-ryzen-5-7600x`
- `specs` JSONB — category-specific structured data (see specs structure below)
- `description`, `image_url`, `release_year`, `is_active`, `created_at`, `updated_at`
- Legacy flat columns still present: `socket`, `supported_ram_types[]`, `max_ram_frequency`, `ram_type`, `frequency_mhz`, `length_mm`, `max_gpu_length_mm`, `wattage`, `tdp`
- Indexes: slug, category, brand, is_active, socket (partial)

**`retailers`** — e-commerce sites
- `id`, `name` UNIQUE, `base_url`, `logo_url`, `country` (default 'MA'), `is_active`, `scraping_interval_hours` (default 24), `last_scrape_at`, `last_scrape_status` (SUCCESS/PARTIAL/FAILED), `notes`

**`prices`** — current price per (component, retailer) pair — UPSERT target
- `id`, `component_id` FK, `retailer_id` FK, `price` NUMERIC(10,2), `in_stock`, `product_url`, `last_updated`
- UNIQUE(component_id, retailer_id)

**`price_history`** — time-series of every price change
- `id`, `component_id` FK, `retailer_id` FK, `price`, `in_stock`, `recorded_at`
- Index on (component_id, recorded_at DESC)

**`scraper_logs`** — scraper run logs
- `id`, `level` (INFO/WARNING/ERROR), `site`, `message`, `created_at`

**`admins`** — admin accounts
- `id`, `username` UNIQUE, `password_hash` (bcrypt), `created_at`

**`scraper_mappings`** — links retailer product URLs to canonical components
- `id`, `component_id` FK, `retailer_id` FK, `product_url`, `product_identifier`, `created_at`, `updated_at`
- UNIQUE(retailer_id, product_url)

**`preset_builds`** — curated PC builds
- `id`, `name`, `description`, `use_case` (gaming/workstation/office/budget), `total_price_estimate`, `is_active`, `created_at`, `updated_at`

**`preset_build_components`** — junction table
- `id`, `preset_build_id` FK, `component_id` FK, `category`
- UNIQUE(preset_build_id, category) — one component per slot per preset

**`unmatched_listings`** — scraped products with no mapping
- `id`, `retailer_id` FK, `product_url`, `scraped_name`, `scraped_price`, `scraped_at`, `status` (pending/linked/dismissed), `linked_component_id` FK nullable
- UNIQUE(retailer_id, product_url)

**`admin_activity_log`** — audit trail
- `id`, `admin_id` FK, `action`, `entity_type`, `entity_id`, `details` JSONB, `created_at`
- Index on created_at DESC

**`refresh_tokens`** — session management
- `id`, `admin_id` FK, `token` UNIQUE, `expires_at`, `created_at`
- Indexes on token and expires_at

### Specs JSONB structure per category
| Category | Fields |
|---|---|
| cpu | socket, cores, threads, base_clock_ghz, boost_clock_ghz, tdp |
| motherboard | socket, chipset, form_factor, ram_slots, max_ram_gb, supported_ram_types, max_ram_frequency |
| gpu | chipset, vram_gb, length_mm, tdp, pcie_version |
| ram | ram_type, capacity_gb, frequency_mhz, cas_latency, voltage |
| storage | type, capacity_gb, interface, read_speed_mbps, write_speed_mbps |
| psu | wattage, efficiency_rating, modular, form_factor |
| case | form_factor, max_gpu_length_mm, max_cpu_cooler_height_mm, drive_bays |
| cooling | type, socket_compatibility, tdp_rating, fan_size_mm, noise_level_db |

---

## 6. Full API Route Reference

### Public routes (no auth required)

| Method | Route | Handler file | What it does |
|---|---|---|---|
| POST | `/api/auth/login` | routes/auth.ts | Returns JWT access token (15min) + sets HttpOnly refresh token cookie (7 days) |
| POST | `/api/auth/refresh` | routes/auth.ts | Validates refresh token cookie, returns new access token |
| POST | `/api/auth/logout` | routes/auth.ts | Deletes refresh token from DB, clears cookie |
| GET | `/api/components` | routes/components.ts | Paginated list — params: category, socket, ram_type, brand, search, page, limit (max 100). Returns X-Total-Count header. Excludes is_active=false |
| GET | `/api/components/slug/:slug` | routes/components.ts | Single component by slug (MUST be registered before /:id) |
| GET | `/api/components/smart-search` | routes/smartSearch.ts | DNA-based smart search using componentMatcher |
| GET | `/api/components/:id` | routes/components.ts | Single component by ID, full data including specs JSONB |
| GET | `/api/components/:id/prices` | routes/prices.ts | Price offers sorted cheapest first, with retailer name |
| GET | `/api/components/:id/price-history` | routes/components.ts | Price history — params: retailer_id, days (default 30) |
| POST | `/api/compatibility/validate` | routes/compatibility.ts | Validates a build, returns errors[] and warnings[] |
| GET | `/api/builds/presets` | routes/presets.ts | Preset builds — param: use_case filter. Flags incomplete presets |
| GET | `/api/health` | routes/health.ts | Returns `{ status: "ok", timestamp: "<ISO8601>" }` |

### Protected routes (require `Authorization: Bearer <JWT>`)

| Method | Route | Handler file | What it does |
|---|---|---|---|
| GET | `/api/admin/dashboard` | routes/admin/dashboard.ts | Stats cards + price updates chart (30 days) + recent activity (10 entries) |
| GET | `/api/admin/components` | routes/admin/components.ts | List with search/filter/sort |
| POST | `/api/admin/components` | routes/admin/components.ts | Create component, auto-generates slug, logs activity |
| PUT | `/api/admin/components/:id` | routes/admin/components.ts | Update component, logs activity |
| DELETE | `/api/admin/components/:id` | routes/admin/components.ts | Delete — returns HTTP 409 if linked prices/mappings exist |
| POST | `/api/admin/components/import` | routes/admin/components.ts | Bulk import CSV or JSON (multipart/form-data), validates all rows before persisting, returns report |
| GET | `/api/admin/logs` | routes/admin/logs.ts | Scraper logs — params: level, site, limit |
| GET | `/api/admin/retailers` | routes/admin/retailers.ts | List with scraping stats (last run, price record count) |
| POST | `/api/admin/retailers` | routes/admin/retailers.ts | Create retailer |
| PUT | `/api/admin/retailers/:id` | routes/admin/retailers.ts | Update retailer |
| DELETE | `/api/admin/retailers/:id` | routes/admin/retailers.ts | Deactivate (sets is_active=false) |
| POST | `/api/admin/scrapers/:retailerId/run` | routes/admin/scrapers.ts | Trigger immediate scrape for one retailer. HTTP 409 if already running |
| POST | `/api/admin/scrapers/run-all` | routes/admin/scrapers.ts | Trigger all active retailers sequentially |
| GET | `/api/admin/unmatched-listings` | routes/admin/unmatched.ts | List — params: status, retailer_id |
| POST | `/api/admin/unmatched-listings/:id/link` | routes/admin/unmatched.ts | Link to component, creates scraper_mappings entry |
| POST | `/api/admin/unmatched-listings/:id/dismiss` | routes/admin/unmatched.ts | Sets status to dismissed |
| GET | `/api/admin/presets` | routes/admin/presets.ts | List all presets including inactive |
| POST | `/api/admin/presets` | routes/admin/presets.ts | Create preset with components in transaction |
| PUT | `/api/admin/presets/:id` | routes/admin/presets.ts | Update preset |
| DELETE | `/api/admin/presets/:id` | routes/admin/presets.ts | Delete preset |

### Route registration order in app.ts (important)
```
/api/auth
/api/components/smart-search   ← MUST be before /api/components (avoids /:id catch-all)
/api/components
/api/components (prices router) ← GET /:id/prices
/api/compatibility
/api/health
/api/admin/dashboard
/api/admin/components
/api/admin/logs
/api/admin/retailers
/api/admin/scrapers
/api/admin/unmatched-listings
```

### Error response format (all errors)
```json
{ "error": { "code": "ERROR_CODE", "message": "...", "fields": [] } }
```
`fields` only present on HTTP 400 validation errors.

---

## 7. Backend Services — What Each Does

### `compatibilityService.ts`
The core business logic. `validateCompatibility(build)` runs 6 rules and returns `{ errors[], warnings[] }`.

| Rule code | Type | Condition |
|---|---|---|
| `socket_mismatch` | error | CPU socket ≠ Motherboard socket |
| `ram_type_mismatch` | error | RAM type not in Motherboard's supported_ram_types[] |
| `ram_frequency_exceeded` | warning | RAM frequency > Motherboard's max_ram_frequency |
| `gpu_too_long` | error | GPU length_mm > Case max_gpu_length_mm |
| `psu_underpowered` | error | PSU wattage < total TDP × 1.2 |
| `psu_recommendation` | warning | PSU wattage < total TDP × 1.5 (soft warning) |

### `componentService.ts`
All DB queries for components.
- `getComponents(filters)` — paginated list with category/socket/ram_type/brand/search filters, returns `{ components, total }`
- `getComponentById(id)` — full component data
- `getComponentBySlug(slug)` — for detail page lookups
- `createComponent(data)` — generates slug via slugService, inserts all fields
- `updateComponent(id, data)` — updates including updated_at
- `deactivateComponent(id)` — sets is_active=false
- `deleteComponent(id)` — checks for linked prices/mappings first (throws if found)

### `priceHistoryService.ts`
- `getPriceHistory(componentId, retailerId?, days?)` — queries price_history with optional filters
- `recordPriceChange(componentId, retailerId, price, inStock)` — inserts into price_history ONLY if price changed from last recorded value

### `retailerService.ts`
- `getRetailers(includeInactive?)` — list with price record counts
- `getRetailerById(id)`
- `createRetailer(data)`, `updateRetailer(id, data)`, `deactivateRetailer(id)`

### `presetService.ts`
- `getPresets(useCase?)` — active presets with full component data; flags `incomplete` if any component is inactive
- `getPresetById(id)`
- `createPreset(data)` — inserts preset + component links in a transaction
- `updatePreset(id, data)` — replaces component links in a transaction
- `deletePreset(id)` — cascades to preset_build_components

### `adminService.ts`
- `getDashboardStats()` — single call returning all stats (total components by category, retailers, price records, unmatched count, last scrape)
- `getPriceUpdatesChart(days)` — price records updated per day
- `getRecentActivity(limit)` — last N entries from admin_activity_log
- `logActivity(adminId, action, entityType, entityId, details)` — inserts into admin_activity_log

### `slugService.ts`
- `getUniqueSlug(brand, name)` — queries DB for existing slugs, returns unique slug (appends -2, -3 etc. on collision)

---

## 8. Scraping System

### Flow (expansion version)
```
Bun.cron() → Scheduler (reads scraping_interval_hours per retailer from DB)
  → Skip retailers where is_active = false
  → For each active retailer:
      → Scraper (undici fetch + cheerio parse) → ScrapedProduct[]
      → Aggregator:
          → Look up scraper_mappings by (retailer_id, product_url)
          → If mapping found:
              → UPSERT into prices table
              → Call priceHistoryService.recordPriceChange() (inserts only if price changed)
          → If no mapping:
              → INSERT into unmatched_listings (skip if already exists)
      → Update retailers.last_scrape_at and last_scrape_status
      → Logger → INSERT into scraper_logs
```

### Retry logic (baseScraper.ts)
- Up to 3 retries on network timeout or HTTP error
- Exponential backoff: 2s, 4s, 8s delays
- Each retry logged at WARNING level
- After 3 failures: error logged, scraper continues to next product

### Active scrapers
| File | Retailer |
|---|---|
| site1Scraper.ts | Site 1 (generic) |
| site2Scraper.ts | Site 2 (generic) |
| nextlevelScraper.ts | NextLevel |
| setupgameScraper.ts | SetupGame |
| ultrapcScraper.ts | UltraPC |

### Seeded retailers
Electro Bazar (MA), Mattel (MA), Mytek (TN), Wiki (TN), Tunisianet (TN)

---

## 9. Smart Component Matcher (DNA-Based)

**File:** `backend/src/utils/componentMatcher.ts`

This was built after Gemini identified that the old token-matching approach had two failure modes:
1. False positives — "RTX 4070" matched "RTX 4080" (90%+ token overlap, but completely different products)
2. False negatives — "Corsair Vengeance 2x16GB DDR5 6000MHz" failed to match "Corsair Vengeance DDR5 32GB 6000MHz" (kit notation not normalized)

### How it works
Instead of comparing full strings, it extracts a minimal "DNA fingerprint" per category:

| Category | DNA tokens | Example |
|---|---|---|
| GPU | chipset model | `rtx4090`, `rx7900xtx` |
| CPU | family + model number | `ryzen5`, `7600x` |
| RAM | capacity + type + speed | `32gb`, `ddr5`, `6000` |
| Storage | capacity + interface | `2tb`, `nvme` |
| PSU | wattage + efficiency | `850w`, `gold` |
| Motherboard | chipset + socket | `b650e`, `am5` |
| Case | form factor + model tokens | `atx`, `4000d` |
| Cooling | type + size | `240mm`, `aio` |

`scoreDnaMatch(productName, catalogName, category)` — extracts DNA from catalog name, checks if ALL tokens appear in the scraped product name. Returns 0–1.

Key trick: "semi-compact" normalization removes letter→digit spaces but keeps digit→word spaces, making `rtx4090` a standalone word that won't match `rtx4080`.

Kit notation: `2x16GB` → `32gb` before matching.

**29 unit tests** in `backend/src/utils/__tests__/componentMatcher.test.ts`

### Scripts using the matcher
- `scripts/auto_map_ultrapc.ts`
- `scripts/auto_map_nextlevel.ts`
- `scripts/auto_map_setupgame.ts`
- `scripts/remap_all.ts` — runs all 3 + price aggregation + coverage report

---

## 10. Authentication System

### Flow
1. `POST /api/auth/login` — bcrypt.compare password → generate JWT (15min) + UUID refresh token (7 days) → store refresh token in `refresh_tokens` table → return JWT in body + set HttpOnly cookie
2. `POST /api/auth/refresh` — read refresh token from HttpOnly cookie → validate against DB → return new JWT in body
3. `POST /api/auth/logout` — delete refresh token from DB → clear cookie

### Middleware
`authMiddleware` in `backend/src/middleware/auth.ts`:
- Reads `Authorization: Bearer <token>` header
- Verifies JWT with `process.env.JWT_SECRET`
- Attaches decoded admin info to context via `c.set('admin', decoded)`
- Returns HTTP 401 if missing, expired, or invalid

### Token storage
- Access token: in response body (stored in memory on frontend, never localStorage)
- Refresh token: HttpOnly cookie (not accessible to JavaScript)

### Admin panel token refresh
On any 401 response from the API:
1. Call `POST /api/auth/refresh`
2. If success: retry original request with new token
3. If failure: redirect to `/admin/login`

---

## 11. Frontend — User-Facing App (`frontend/`)

React + Vite app. Routes via React Router.

### Routes
| Path | Component | What it shows |
|---|---|---|
| `/` | Home/Configurator | 8-slot component picker + build summary |
| `/components/:slug` | ComponentDetail | Full specs, price comparison table, price history chart |
| `/build` | Build summary | Full build overview |
| `/presets` | Presets | Curated builds grouped by use case |

### Key components
- **Configurator** — 8 slots (cpu, motherboard, gpu, ram, storage, psu, case, cooling), each using ComponentPicker
- **ComponentPicker** — searchable dropdown with 300ms debounce, filter chips (brand, socket, RAM type, price range), "Compatible only" toggle, thumbnail images with category icon fallback, pagination (20/page)
- **BuildSummary** — shows TDP total, compatibility errors and warnings, calls `POST /api/compatibility/validate`
- **PriceComparison** — table of current offers sorted cheapest first, with retailer links
- **PriceHistoryChart** — Recharts line chart, X=date, Y=price (MAD), one line per retailer, 30-day default, shows "not yet available" if <2 data points

### API client (`frontend/src/api.ts`)
Functions: `getComponents()`, `getComponentById()`, `getComponentBySlug()`, `getPrices()`, `getPriceHistory()`, `validateBuild()`, `getPresets()`

---

## 12. Admin Panel (`admin/`)

Separate React + Vite app. Served at `/admin`.

### Routes
| Path | Page | What it does |
|---|---|---|
| `/admin/login` | Login.tsx | Email + password form, stores access token in memory |
| `/admin/dashboard` | Dashboard.tsx | Stats cards, bar chart (price updates/day), recent activity feed, auto-refreshes every 60s |
| `/admin/components` | Components.tsx | List with search/filter/sort, Edit/Deactivate/Delete actions |
| `/admin/components/import` | BulkImport.tsx | CSV or JSON upload, preview, conflict resolution, import report |
| `/admin/retailers` | Retailers.tsx | List with last scrape info, CRUD form |
| `/admin/scrapers` | Scrapers.tsx | Status table per retailer, "Run Now" / "Run All" buttons, log viewer (last 100, filterable) |
| `/admin/unmatched` | Unmatched.tsx | Queue of unmatched listings, "Link" modal with component search, "Dismiss" |
| `/admin/presets` | Presets.tsx | Preset builds list, create/edit form with per-slot component selectors |

### API client (`admin/src/api.ts`)
Auth-aware fetch wrapper:
- Attaches `Authorization: Bearer <token>` to every request
- On 401: calls `/api/auth/refresh`, retries original request
- On refresh failure: redirects to `/admin/login`

---

## 13. Test Suite

**319 tests passing, 0 failing across 26 test files** (last run: April 28, 2026)

### Test file locations
```
backend/src/services/__tests__/
  componentService.test.ts

backend/src/routes/__tests__/
  (route integration tests)

backend/src/routes/admin/__tests__/
  components.test.ts
  logs.test.ts
  (other admin route tests)

backend/src/utils/__tests__/
  slugify.test.ts
  componentMatcher.test.ts   ← 29 tests for DNA matcher

backend/scraper/scrapers/__tests__/
  baseScraper.test.ts
  site1Scraper.test.ts
  site2Scraper.test.ts

backend/scraper/utils/__tests__/
  logger.test.ts

backend/scraper/__tests__/
  aggregator.test.ts
  scheduler.test.ts
  scraperIsolation.pbt.test.ts   ← property-based test
```

### Property-based tests (fast-check) — all 11 implemented
| Test | Property | Requirement |
|---|---|---|
| 2.2 | CPU/Motherboard socket consistency | Req 2.1, 2.2 |
| 2.3 | RAM type/Motherboard consistency | Req 3.1, 3.2 |
| 2.4 | RAM frequency exceeded warning | Req 3.3 |
| 2.5 | Total TDP + PSU recommendation | Req 5.1, 5.2 |
| 2.6 | Underpowered PSU warning | Req 5.3 |
| 2.7 | GPU/Case clearance | Req 4.1, 4.2 |
| 5.1 | Admin endpoints require valid JWT | Req 11.3, 11.4 |
| 6.2 | Price offers sorted ascending | Req 7.1 |
| 7.2 | Required field validation → HTTP 400 | Req 8.2, 8.3 |
| 7.4 | Log filtering returns only matching entries | Req 9.3 |
| 10.6 | Scraper error isolation | Req 6.4, 9.2 |

### How to run tests
```powershell
wsl -d Ubuntu -- bash -c "cd /mnt/c/Headquarters/Projects/PcBuilder/backend && ~/.bun/bin/bun test 2>&1"
```

### Test tsconfig pattern
Each `__tests__/` folder has its own `tsconfig.json` that excludes `bun:test` from the main tsconfig to avoid VS Code errors on Windows. Test files use `// @ts-nocheck` if needed.

---

## 14. Deployment Setup

### Docker Compose services
| Service | Image | Role |
|---|---|---|
| postgres | postgres:15-alpine | Database, mounts migrations as init scripts |
| backend | oven/bun:1.3-alpine (custom Dockerfile) | Bun + Hono API, mounts frontend/dist |
| nginx | nginx:alpine | Serves frontend static files, proxies /api to backend |

### Nginx routing
- `/` → frontend static files (SPA fallback to index.html)
- `/api` → proxy to backend:3000
- `/admin` → admin panel static files (SPA fallback to admin/index.html)

### Environment variables (from `.env.example`)
```
DB_NAME=pcbuilder
DB_USER=pcbuilder_user
DB_PASSWORD=<secret>
JWT_SECRET=<min 32 chars>
PORT=3000
NODE_ENV=production
SERVE_STATIC=true
ALLOWED_ORIGINS=https://pcbuilder.ma
VITE_API_BASE_URL=https://pcbuilder.ma/api
```

### Static file serving (production mode)
When `NODE_ENV=production` and `SERVE_STATIC=true`:
- `app.use('/admin/*', serveStatic({ root: './admin/dist' }))`
- `app.use('/*', serveStatic({ root: './frontend/dist' }))`
- SPA fallback: `app.use('/*', serveStatic({ path: './frontend/dist/index.html' }))`

### Health check
`GET /api/health` → `{ "status": "ok", "timestamp": "<ISO8601>" }` — used by load balancers

---

## 15. Seed Data

### `seed_catalog.sql` / `seed_catalog_v2.sql`
150+ real-world components across all 8 categories, representative of the Moroccan market:
- CPUs (20): AMD Ryzen 5/7/9 AM5, Intel Core i5/i7/i9 LGA1700
- Motherboards (18): B650, X670, B760, Z790
- GPUs (25): RX 6600–7900 XTX, RTX 3060–4090
- RAM (20): DDR4 and DDR5 kits from Corsair, G.Skill, Kingston
- Storage (20): NVMe SSDs and SATA SSDs from Samsung, WD, Seagate
- PSUs (18): 550W–1000W from Corsair, be quiet!, Seasonic
- Cases (15): ATX and mATX from NZXT, Fractal, Lian Li
- Cooling (14): Air coolers and AIOs from Noctua, be quiet!, Corsair

### `seed_retailers.sql`
Electro Bazar (MA), Mattel (MA), Mytek (TN), Wiki (TN), Tunisianet (TN)

### `seed_presets.sql`
4 preset builds:
| Name | Use case | Est. price |
|---|---|---|
| Budget Gaming Build | gaming | ~8,500 MAD |
| Mid-Range Gaming | gaming | ~15,000 MAD |
| High-End Workstation | workstation | ~25,000 MAD |
| Office PC | office | ~4,500 MAD (no GPU — intentional) |

---

## 16. Known Issues (Improvement Report)

33 issues catalogued in `notes/improvement-report.md`. Summary by severity:

### Critical (7 issues — breaks functionality)
1. `ComponentDetail` page uses wrong slug lookup (search instead of dedicated route) — fix: add `GET /api/components/slug/:slug` (**already wired in routes/components.ts**)
2. `getComponentBySlug` in `api.ts` calls a non-existent endpoint — fix: use the now-wired slug route
3. Prices response shape inconsistent (empty vs populated) — fix: always return `{ offers, message? }`
4. No Zod schema for `cooling` category in `componentSchemas.ts` — fix: add coolingSchema
5. `getComponents` LIKE query doesn't escape `%` and `_` wildcards — fix: escape before passing to query
6. Emoji used as category icons throughout UI — fix: replace with SVG icons
7. Emoji in `App.tsx` logo — fix: remove

### High (8 issues — degrades quality)
8. Components ordered by `id ASC` instead of `name ASC`
9. `BuildSummary` fires validation on every change with no debounce
10. `PriceComparison` not auto-connected to Configurator flow
11. `ComponentDetail` slug lookup N+1 pattern (same as #1)
12. `deleteComponent` has TOCTOU race condition — needs transaction
13. `createComponent`/`updateComponent` use `Record<string, unknown>` — no type safety
14. `getDashboardStats` uses `Promise.all` — partial failure kills whole dashboard
15. Emoji in `Presets.tsx` use case labels

### Medium (10 issues)
16. ComponentPicker missing Escape key handler
17. ComponentPicker trigger button missing aria-label
18. PriceHistoryChart timezone handling
19. `getComponents` filter query verbose/inefficient
20. Duplicate RAM entry in seed_catalog.sql
21. `backfill_slugs.ts` in wrong directory (should be in scripts/)
22. Dynamic import in adminScrapersRouter adds latency
23. Refresh tokens stored as plain text (should be hashed)
24. No CORS configuration — **already fixed in app.ts** (cors middleware present)
25. No rate limiting on login endpoint

### Low (8 issues)
26. CSS variables vs hardcoded hex values inconsistency
27. Raw rule codes shown to users in BuildSummary
28. Emoji in ComponentDetail hero, missing aria-hidden
29. Emoji in incomplete badge in Presets
30. `key={i}` (array index) used in PriceComparison rows
32. No loading skeleton in ComponentPicker
33. Office preset undocumented GPU absence in seed file

> Note: Issue #24 (CORS) is already resolved — `app.ts` has `cors()` middleware configured with `ALLOWED_ORIGINS` env var.
> Note: Issue #1 (slug route) is already resolved — `GET /api/components/slug/:slug` is wired in `routes/components.ts`.

---

## 17. Code Style Rules

- All files: `.ts` extension, ESM imports (`import`/`export`), never `require`
- SQL: always parameterized via Bun.sql template literals — never string interpolation
- Error responses: always `{ "error": { "code": "...", "message": "...", "fields": [] } }`
- HTTP status codes: 200 OK, 400 Validation, 401 Unauthorized, 404 Not Found, 500 Internal
- Use `as const` for readonly arrays/objects used as types
- All code, comments, variable names, file names: English only
- Never put source files in the root directory

---

## 18. Git Rules

- Branch: always `main` (no feature branches)
- Commit format: `type: short description` (conventional commits)
  - `feat:` new feature, `fix:` bug fix, `chore:` maintenance, `docs:` documentation
- Never commit: `.env`, `node_modules/`, `docs/uml/`, `docs/*.pdf`, `.kiro/`
- Always show what will be committed + get approval before committing
- Push from PowerShell: `git push origin main`
- GitHub CLI: `gh` — authenticated as `Omux25`

---

## 19. Completed Task Explainers

One file per completed task in `notes/task-explainers/`:

| File | Task |
|---|---|
| task-01-project-scaffolding.md | Project structure + DB migrations |
| task-02-compatibility-engine.md | 6 compatibility rules |
| task-03-compatibility-tests.md | Compatibility tests checkpoint |
| task-04-zod-schemas-middleware.md | Zod schemas + validation middleware |
| task-05-jwt-auth.md | JWT middleware + auth route |
| task-06-1-component-service.md | Component service (data access) |
| task-06-3-components-routes.md | Public GET /api/components routes |
| task-06-4-prices-route.md | GET /api/components/:id/prices |
| task-06-5-compatibility-route.md | POST /api/compatibility/validate |
| task-07-1-admin-components-routes.md | Admin POST/PUT/DELETE components |
| task-07-3-admin-logs-route.md | GET /api/admin/logs |
| task-08-app-wiring.md | app.ts + server.ts wiring |
| task-10-1-scraper-logger.md | Structured logger → scraper_logs |
| task-10-2-base-scraper.md | Abstract base scraper |
| task-10-3-site-scrapers.md | Site-specific scrapers |
| task-10-4-aggregator.md | Aggregator (UPSERT prices) |
| task-10-5-scheduler.md | Bun.cron() scheduler |
| task-12-frontend.md | Full React frontend |
| task-pbt-all.md | All 11 property-based tests |
| smart-component-matcher.md | DNA-based component matcher |

---

## 20. Diagrams

PlantUML source files in `notes/diagrams/` (committed). Rendered PNGs in `notes/diagrams/rendered/` (gitignored).

| File | Type | Content |
|---|---|---|
| use_case.puml | Use Case | All actors and system use cases |
| class.puml | Class | Domain model — abstract Component + 7 subclasses, services, scrapers, DTOs |
| activity.puml | Activity | Complete user flow |
| sequence_1_compatibility.puml | Sequence | Component selection + compatibility validation |
| sequence_2_price_comparison.puml | Sequence | Price comparison + retailer redirect |
| sequence_3_admin.puml | Sequence | Admin login + component management |
| sequence_scraping.puml | Sequence | Daily price scraping background process |

Regenerate PNGs:
```bash
java -DPLANTUML_LIMIT_SIZE=8192 -jar plantuml.jar -tpng notes/diagrams/<file> -o rendered
```

---

## 21. Documentation Files

All in `notes/` (committed to Git):

| File | Purpose |
|---|---|
| README.md | Index of all documentation |
| roadmap.md | All tasks, status, what's next |
| glossary.md | Alphabetical definitions of every technical term |
| improvement-report.md | 33 catalogued issues (critical → low) |
| guide/stack.md | Every tech choice and why |
| guide/architecture.md | Project structure, layers, API routes, middleware |
| guide/database.md | All 13 tables explained, how to run migrations |
| guide/dev-setup.md | How to run server, tests, migrations locally |
| guide/concepts.md | Plain-language explanations (JWT, Zod, TDP, etc.) |
| guide/git-workflow.md | Commit conventions, branch rules, gitignore |

---

## 22. Change Checklists (Mandatory)

### Adding a new component category
- [ ] Add column(s) to `001_create_components.sql` migration
- [ ] Add Zod schema in `componentSchemas.ts`
- [ ] Add entry to `componentSchemas` map
- [ ] Update `ComponentCategory` type
- [ ] Update `Component` interface in `componentService.ts`
- [ ] Add compatibility rules if needed
- [ ] Update `notes/guide/database.md` — add column to table
- [ ] Update `notes/glossary.md` — add new category and terms
- [ ] Update `notes/diagrams/class.puml` — add new subclass
- [ ] Update relevant task explainer or add new one
- [ ] Run all tests and confirm they pass

### Adding a new compatibility rule
- [ ] Add rule in `compatibilityService.ts`
- [ ] Add required field(s) to affected component type(s)
- [ ] Add required field(s) to DB schema if not present
- [ ] Add required field(s) to Zod schema
- [ ] Write unit tests (rule fires, rule doesn't fire, rule skips when component absent)
- [ ] Update `notes/guide/concepts.md` — add rule to compatibility section
- [ ] Update `notes/glossary.md` — add new terms
- [ ] Update `notes/diagrams/sequence_1_compatibility.puml` if flow changes
- [ ] Update relevant task explainer or add new one
- [ ] Run all tests and confirm they pass

### Adding a new API route
- [ ] Create route file in `backend/src/routes/`
- [ ] Wire in `backend/src/app.ts`
- [ ] Apply `authMiddleware` if protected
- [ ] Apply `validateComponent` if accepts component body
- [ ] Write unit/integration tests
- [ ] Update `notes/guide/architecture.md` — add route to table
- [ ] Update `notes/glossary.md` if new concepts introduced
- [ ] Update relevant task explainer or add new one
- [ ] Run all tests and confirm they pass

### Adding a new database table or column
- [ ] Create or update migration file in `backend/src/db/migrations/`
- [ ] Update relevant TypeScript interface(s) in service layer
- [ ] Update `notes/guide/database.md` — document new table/column
- [ ] Update `notes/diagrams/database.puml` if ERD changes (regenerate PNG)
- [ ] Update `notes/glossary.md` if new SQL concepts introduced
- [ ] Update relevant task explainer or add new one

---

## 23. Quick Reference — Common Commands

```powershell
# Run all tests (from PowerShell)
wsl -d Ubuntu -- bash -c "cd /mnt/c/Headquarters/Projects/PcBuilder/backend && ~/.bun/bin/bun test 2>&1"

# Run specific test file
wsl -d Ubuntu -- bash -c "cd /mnt/c/Headquarters/Projects/PcBuilder/backend && ~/.bun/bin/bun test src/services/__tests__/componentService.test.ts 2>&1"

# Start backend dev server (run manually in WSL2 terminal)
cd /mnt/c/Headquarters/Projects/PcBuilder/backend
~/.bun/bin/bun --hot src/server.ts

# Start frontend dev server (run manually in WSL2 terminal)
cd /mnt/c/Headquarters/Projects/PcBuilder/frontend
~/.bun/bin/bun run dev

# Start admin panel dev server (run manually in WSL2 terminal)
cd /mnt/c/Headquarters/Projects/PcBuilder/admin
~/.bun/bin/bun run dev

# Run remap_all (scrape + match + aggregate + coverage report)
wsl -d Ubuntu -- bash -c "cd /mnt/c/Headquarters/Projects/PcBuilder/backend && ~/.bun/bin/bun run scripts/remap_all.ts 2>&1"

# Git status + recent commits (PowerShell)
git status; git log --oneline -5

# Push to GitHub (PowerShell)
git push origin main

# Get gh auth token (if needed for WSL2 push)
gh auth token
```

---

*This file was auto-generated on April 28, 2026. It reflects the state of the codebase at that point. Update it after major changes.*

## 24. Gemini Technical Review — 6 Areas of Improvement

Gemini reviewed the full project and gave the following critique (`.kiro/specs/gemini/gemini chats.txt`):

### 1. Missing CI/CD Pipeline (DevSecOps blindspot)
- No GitHub Actions workflow exists
- Tests are run manually via WSL2 — if forgotten, broken code ships
- Fix: GitHub Actions on push to main — checkout, install Bun, run `bun test`, optionally run Semgrep for security scanning
- Especially relevant given the cybersecurity internship focus

### 2. Security vulnerabilities (elevate to drop-everything priority)
- **Issue #23** — Refresh tokens stored as plain text in DB. If `refresh_tokens` table is compromised, attacker has persistent access. Fix: hash with bcrypt before storing, compare hash on refresh.
- **Issue #25** — No rate limiting on `POST /api/auth/login`. Vulnerable to brute-force credential stuffing. Fix: max 5 attempts per 15 minutes per IP in Hono middleware.
- **Issue #5** — Unescaped LIKE wildcards. While Bun parameterization prevents SQLi, unescaped `%` and `_` can cause expensive wildcard matching (DoS vector).

### 3. Scraping system fragility
- Pure HTTP + Cheerio fails instantly if a site requires JS rendering or presents a CAPTCHA/Cloudflare challenge
- Fix: keep Cheerio scrapers for speed, add headless browser fallback (Puppeteer/Playwright) for JS-rendered sites
- Alternatively: rotating residential proxies if IP-banned
- The retry + exponential backoff is good — ensure admin dashboard prominently flags consistent FAILED status per retailer

### 4. Database and query optimization
- N+1 queries on component detail page (Issues #1, #11) — use SQL JOINs to fetch component + prices + history in fewer round-trips
- Soft deletes: rely on `is_active` boolean rather than blocking hard deletes with HTTP 409 — deactivating should cascade to hide from public API

### 5. Missing user-facing feature — no user accounts or build sharing
- Users can't save a build after spending 20 minutes configuring it
- Fix option A: public user accounts
- Fix option B (simpler): shareable build URLs — encode component IDs as base64 in URL params (e.g. `/build?c=eyJjcHUiOjEwLCJncHUiOjQwfQ==`)

### 6. Code style and workflow
- Single-branch workflow (`main` only) is fine for a student project but bad professional habit — feature branches + PRs are the industry standard
- `Record<string, unknown>` in `createComponent`/`updateComponent` defeats TypeScript — enforce strict Zod schema parsing at the service boundary

---

## 25. Gemini Scraping Techniques Reference

From `.kiro/specs/gemini/gemini scrap.txt` — the technical guidance that informed the NextLevel and SetupGame scrapers:

### NextLevel (WooCommerce)
WooCommerce REST API (`/wp-json/wc/v3/products`) requires admin keys — not publicly accessible. `li.product` returns 0 results because modern WooCommerce themes (WoodMart, Flatsome) load the product grid via a secondary JS fetch after the HTML shell loads — undici only gets the shell.

**Approach 1 — JSON-LD (preferred):** Almost all WooCommerce stores inject product data as JSON-LD via SEO plugins (Yoast, RankMath). Extract with cheerio:
```typescript
$('script[type="application/ld+json"]').each((_, el) => {
  const jsonData = JSON.parse($(el).html()!);
  const graph = [jsonData].flatMap(item => item['@graph'] || item);
  for (const node of graph) {
    if (node['@type'] === 'Product') {
      // node.name, node.url, node.offers.price, node.offers.availability
    }
  }
});
```

**Approach 2 — HTML fallback:** Log raw HTML from undici to a file, search for a known product name, find the actual CSS classes (e.g. `.product-grid-item`, `.wd-product`). Do NOT use browser inspector — it shows post-JS DOM.

### SetupGame (React/Next.js SPA)
If every URL returns the same HTML shell, it's a CSR app. Two approaches:

**Approach 1 — Reverse-engineer the API (Network Tab method):**
1. Open DevTools → Network → Fetch/XHR filter
2. Navigate to a category
3. Find the API request (e.g. `api.setupgame.ma/v1/products?category=cpu`)
4. Copy as cURL, translate to undici request
5. Include headers: `Origin`, `Referer`, `Accept`, `User-Agent` to bypass CORS/WAF

**Approach 2 — `__NEXT_DATA__` trick (if Next.js Pages Router):**
```typescript
const nextDataString = $('#__NEXT_DATA__').html();
if (nextDataString) {
  const nextData = JSON.parse(nextDataString);
  const buildId = nextData.buildId;
  const pageProps = nextData.props?.pageProps;
  // pageProps.products may already be fully hydrated
  // Pagination URL pattern: /_next/data/{buildId}/category/processeur.json
}
```

### UltraPC
Already solved by reverse-engineering the PrestaShop AJAX API (mentioned in the chat as the approach that worked).

---
