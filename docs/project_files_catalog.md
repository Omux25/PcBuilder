# 📂 Curated Project Files Catalog

This catalog indexes the primary source files and architectural entry-points of the **PC Builder Morocco** workspace. It is designed to be lightweight, token-lean, and easy to maintain.

> [!NOTE]
> For compiled files, build assets (e.g., `dist/`), test scripts, migration lists, or configuration boilerplate, refer to the directory listing or Git status. They are excluded from this catalog to prevent document bloat.

---

## 🏗️ Core Workspace Entrypoints

| File Path | Component | Role & Purpose |
| :--- | :--- | :--- |
| [**`dev.ps1`**](file:///c:/Headquarters/Projects/PcBuilder/dev.ps1) | Root | Development orchestrator script that starts Frontend, Backend, and Admin SPAs in parallel. |
| [**`README.md`**](file:///c:/Headquarters/Projects/PcBuilder/README.md) | Root | Project overview, setup prerequisites, quick-start guide, and **Documentation Hub**. |
| [**`ROADMAP.md`**](file:///c:/Headquarters/Projects/PcBuilder/ROADMAP.md) | Root | High-level roadmap tracking planned features (FPS Estimator, PDF Export, Accounts). |

---

## 📡 Backend API (`apps/backend`)

The backend API is built using **Hono** running on the **Bun** runtime.

### ⚙️ System Core
| File Path | Role & Purpose |
| :--- | :--- |
| [**`server.ts`**](file:///c:/Headquarters/Projects/PcBuilder/apps/backend/src/server.ts) | Central server entry point. Sets up the Bun.serve socket listener and coordinates graceful shutdown. |
| [**`app.ts`**](file:///c:/Headquarters/Projects/PcBuilder/apps/backend/src/app.ts) | Registers core middlewares (CORS, logs, errors) and mounts domain sub-routers. |
| [**`core/db/index.ts`**](file:///c:/Headquarters/Projects/PcBuilder/apps/backend/src/core/db/index.ts) | Central database connector. Exports dynamic PG pool instances for SQL queries. |
| [**`core/db/migrate.ts`**](file:///c:/Headquarters/Projects/PcBuilder/apps/backend/src/core/db/migrate.ts) | Programmatic database migration runner executing SQL scripts in order. |

### 🧬 Scraping & Catalog Ingestion
| File Path | Role & Purpose |
| :--- | :--- |
| [**`aggregator.ts`**](file:///c:/Headquarters/Projects/PcBuilder/apps/backend/src/modules/scraping/engine/aggregator.ts) | Price scraper classifier. Matches incoming merchant listings against active catalog components. |
| [**`catalogBuilder.ts`**](file:///c:/Headquarters/Projects/PcBuilder/apps/backend/src/modules/scraping/engine/catalogBuilder.ts) | Automatically creates default component records when high-confidence new parts are detected. |
| [**`unmatchedService.ts`**](file:///c:/Headquarters/Projects/PcBuilder/apps/backend/src/modules/scraping/unmatched/services/unmatchedService.ts) | Service handling manual curation links, suggestions matching, and unmatched items cleanup. |

### 🗄️ Query & Repositories
| File Path | Role & Purpose |
| :--- | :--- |
| [**`componentRepository.ts`**](file:///c:/Headquarters/Projects/PcBuilder/apps/backend/src/modules/catalog/repositories/componentRepository.ts) | Main database repository for querying products, filtering, dynamic sorting, and facet counts. |

### 🔗 Build Sharing & Redirects
| File Path | Role & Purpose |
| :--- | :--- |
| [**`shareController.ts`**](file:///c:/Headquarters/Projects/PcBuilder/apps/backend/src/modules/builds/controllers/shareController.ts) | Backend controller handling the short URL redirect page generation, OpenGraph metadata compile logic, and builds retrieving database operations. |

---

## 🎨 Frontend Configurator (`apps/frontend`)

The primary client application is a client-side React SPA.

| File Path | Role & Purpose |
| :--- | :--- |
| [**`BuildContext.tsx`**](file:///c:/Headquarters/Projects/PcBuilder/apps/frontend/src/context/BuildContext.tsx) | Global state manager for the active PC build. Orchestrates compatibility checks and shares link deserialization. |
| [**`Configurator.tsx`**](file:///c:/Headquarters/Projects/PcBuilder/apps/frontend/src/components/Configurator.tsx) | The primary builder canvas containing parts slots, active price estimates, and compatibility warning tickers. |
| [**`ShareModal.tsx`**](file:///c:/Headquarters/Projects/PcBuilder/apps/frontend/src/components/ShareModal.tsx) | Premium dark glassmorphic dialog providing URL shortened links, QR codes, and quick copy layouts. |
| [**`utils/exportFormatter.ts`**](file:///c:/Headquarters/Projects/PcBuilder/apps/frontend/src/utils/exportFormatter.ts) | Layouter utility class formatting configurations into Reddit tables, BBCode, or Discord lists for external sharing. |

---

## 🛡️ Administrative Panel (`apps/admin`)

The internal operational operational dashboard for managing catalogs and rules.

| File Path | Role & Purpose |
| :--- | :--- |
| [**`Unmatched.tsx`**](file:///c:/Headquarters/Projects/PcBuilder/apps/admin/src/pages/Unmatched.tsx) | Control screen displaying unmatched scrapings, allowing manual linking or category shifts. |
| [**`KeywordRules.tsx`**](file:///c:/Headquarters/Projects/PcBuilder/apps/admin/src/pages/KeywordRules.tsx) | Control panel for managing matching regexes and keyword priorities. |
| [**`TokenPicker.tsx`**](file:///c:/Headquarters/Projects/PcBuilder/apps/admin/src/components/TokenPicker.tsx) | Interactive component rendering words in scraped titles as clickable keyword rule triggers. |

---

## 📦 Shared Library (`shared`)

Shared logic and types utilized by both client and API.

| File Path | Role & Purpose |
| :--- | :--- |
| [**`compatibility.engine.ts`**](file:///c:/Headquarters/Projects/PcBuilder/shared/engine/compatibility.engine.ts) | The main validator checking sockets, dimensions, RAM slot counts, and TDP values. |
| [**`types.ts`**](file:///c:/Headquarters/Projects/PcBuilder/shared/types.ts) | Shared TypeScript models, components interfaces, and API request schemas. |
| [**`schemas/component.schema.ts`**](file:///c:/Headquarters/Projects/PcBuilder/shared/schemas/component.schema.ts) | Shared Zod schemas validating component form fields and API parameters. |
