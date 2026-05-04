# Requirements Document

## Introduction

This document defines the requirements for the **PC Builder Platform Expansion** — a major upgrade to the existing MVP. The platform is a PC price comparator and compatibility checker targeting the Moroccan market. The expansion transforms it from a minimal proof-of-concept into a production-ready platform with a canonical component catalog, a fully-featured admin panel, an improved user-facing interface, price history tracking, and deployment readiness.

The core architectural shift introduced by this expansion is the **canonical catalog model**: components are curated and managed centrally by administrators, and scrapers link retailer prices to existing catalog entries rather than creating new component records. This eliminates duplicate entries, inconsistent naming, and data quality issues.

---

## Glossary

- **Catalog**: The curated, administrator-managed database of PC components with clean, standardized names and specifications.
- **Canonical Component**: A component entry in the Catalog that represents a real-world product with authoritative specs, independent of any retailer listing.
- **Scraper**: Automated scripts (cheerio + undici) that extract prices and stock availability from Moroccan e-commerce sites and link results to Canonical Components.
- **Retailer**: A Moroccan e-commerce website referenced in the platform (e.g., Electro Bazar, Mattel, Mytek).
- **Price Record**: A scraped price entry linking a Canonical Component to a Retailer, including price, stock status, product URL, and timestamp.
- **Price History**: The time-series record of all Price Records for a given Canonical Component at a given Retailer.
- **Admin Panel**: The protected web interface through which Administrators manage the Catalog, Retailers, Scrapers, and platform configuration.
- **Administrator**: A user with elevated privileges who manages the platform through the Admin Panel.
- **User**: Any visitor who accesses the public-facing platform to configure a PC build and compare prices.
- **Configurator**: The interactive module that allows the User to select and assemble PC components into a build.
- **Compatibility Engine**: The backend subsystem that validates compatibility rules between selected components.
- **Build**: A named collection of selected Canonical Components assembled by a User.
- **Preset Build**: A curated Build created by an Administrator for a specific use case or budget tier.
- **Slug**: A URL-safe, human-readable identifier derived from a component's name (e.g., `amd-ryzen-5-7600x`).
- **TDP**: Thermal Design Power — the maximum power consumption of a component, expressed in watts.
- **Socket**: The physical interface between a CPU and a Motherboard (e.g., AM5, LGA1700).
- **API**: The Hono-based REST API exposed by the backend.
- **JWT**: JSON Web Token — used for authenticating Administrator sessions.
- **Seed**: A SQL or script file that populates the Catalog with an initial set of real-world components.

---

## Requirements

---

### Requirement 1: Canonical Component Catalog

**User Story:** As an Administrator, I want to manage a curated catalog of PC components with clean, standardized data, so that the platform always displays accurate product information regardless of how retailers name their listings.

#### Acceptance Criteria

1. THE Catalog SHALL store Canonical Components with the following fields: `id`, `slug`, `name`, `brand`, `category`, `description`, `specs` (JSONB), `image_url`, `release_year`, `is_active`, `created_at`, `updated_at`.
2. THE Catalog SHALL support the following component categories: `cpu`, `motherboard`, `gpu`, `ram`, `storage`, `psu`, `case`, `cooling`.
3. WHEN a Canonical Component is created, THE API SHALL generate a unique `slug` from the component's brand and name (e.g., `amd-ryzen-5-7600x`).
4. IF a slug collision occurs during component creation, THEN THE API SHALL append a numeric suffix to ensure uniqueness (e.g., `amd-ryzen-5-7600x-2`).
5. THE Catalog SHALL store category-specific technical specs in a structured `specs` JSONB column, with the required fields per category defined in the API validation schema.
6. THE Catalog SHALL ship with a seed dataset of at least 150 real-world components covering all 8 categories, representative of products available in the Moroccan market.
7. WHEN a Canonical Component's `is_active` field is set to `false`, THE API SHALL exclude it from all public-facing endpoints while retaining it in the database.

---

### Requirement 2: Scraper-to-Catalog Linking

**User Story:** As an Administrator, I want scraped prices to be linked to existing Canonical Components rather than creating new entries, so that the catalog remains clean and free of duplicates.

#### Acceptance Criteria

1. THE Scraper SHALL match scraped product listings to Canonical Components using a configurable mapping table (`scraper_mappings`) that associates a retailer's product URL or product identifier with a `component_id`.
2. WHEN the Scraper encounters a product URL that has no entry in `scraper_mappings`, THE Scraper SHALL log the unmatched listing as an `UNMATCHED` event and skip price insertion.
3. THE Admin Panel SHALL provide an interface for Administrators to review unmatched listings and manually link them to a Canonical Component, creating a new `scraper_mappings` entry.
4. WHEN a mapping is created or updated, THE API SHALL validate that the referenced `component_id` exists in the Catalog.
5. THE Scraper SHALL update the `prices` table using an UPSERT operation keyed on `(component_id, retailer_id)`, preserving the full price history in a separate `price_history` table.

---

### Requirement 3: Price History Tracking

**User Story:** As a User, I want to see how a component's price has changed over time, so that I can make informed purchasing decisions.

#### Acceptance Criteria

1. THE API SHALL maintain a `price_history` table that records every price change for each `(component_id, retailer_id)` pair, with columns: `id`, `component_id`, `retailer_id`, `price`, `in_stock`, `recorded_at`.
2. WHEN the Scraper updates a price and the new price differs from the most recent recorded price for that `(component_id, retailer_id)` pair, THE Aggregator SHALL insert a new row into `price_history`.
3. THE API SHALL expose `GET /api/components/:id/price-history` returning price history entries for a component, optionally filtered by `retailer_id` and `days` query parameters.
4. THE Configurator SHALL display a price history chart on the component detail page, showing price over time per retailer, for the past 30 days by default.
5. WHEN fewer than 2 data points exist for a component's price history, THE Configurator SHALL display a message indicating that price history is not yet available.

---

### Requirement 4: Retailer Management

**User Story:** As an Administrator, I want to manage the list of retailers through the Admin Panel, so that I can add, configure, and disable retailers without modifying application code.

#### Acceptance Criteria

1. THE Admin Panel SHALL allow Administrators to create, update, and deactivate Retailers with the following fields: `name`, `base_url`, `logo_url`, `country` (default: `MA`), `is_active`, `scraping_interval_hours`, `notes`.
2. WHEN a Retailer's `is_active` field is set to `false`, THE Scheduler SHALL skip that Retailer in all future scraping runs.
3. THE Admin Panel SHALL display a Retailer list showing each retailer's name, active status, last successful scrape time, and total number of linked price records.
4. WHEN an Administrator updates a Retailer's `scraping_interval_hours`, THE Scheduler SHALL apply the new interval on the next scheduled evaluation without requiring a server restart.
5. THE API SHALL expose protected CRUD endpoints for Retailers under `/api/admin/retailers`.

---

### Requirement 5: Scraper Management

**User Story:** As an Administrator, I want to trigger and monitor scraping jobs from the Admin Panel, so that I can refresh price data on demand and diagnose issues without accessing the server.

#### Acceptance Criteria

1. THE Admin Panel SHALL display a Scraper Status dashboard showing, for each Retailer: last run time, last run status (SUCCESS, PARTIAL, FAILED), number of prices updated, and number of unmatched listings.
2. WHEN an Administrator clicks "Run Now" for a specific Retailer, THE API SHALL trigger an immediate scraping job for that Retailer and return a job ID.
3. WHEN an Administrator clicks "Run All", THE API SHALL trigger scraping jobs for all active Retailers sequentially and return a summary.
4. THE Admin Panel SHALL display a live-updating log view showing the most recent 100 scraper log entries, filterable by retailer, severity (INFO, WARNING, ERROR), and date range.
5. THE Admin Panel SHALL display the list of unmatched listings with the retailer name, product URL, scraped name, and scraped price, allowing the Administrator to link each to a Canonical Component or dismiss it.
6. IF a scraping job is already running for a Retailer, THEN THE API SHALL return HTTP 409 and reject a duplicate trigger request.

---

### Requirement 6: Bulk Component Import

**User Story:** As an Administrator, I want to import multiple components at once from a CSV or JSON file, so that I can populate the catalog efficiently without entering each component manually.

#### Acceptance Criteria

1. THE Admin Panel SHALL provide a file upload interface accepting CSV and JSON files for bulk component import.
2. WHEN a CSV file is uploaded, THE API SHALL parse it expecting the following columns: `name`, `brand`, `category`, and all category-specific spec fields as additional columns.
3. WHEN a JSON file is uploaded, THE API SHALL parse it expecting an array of component objects conforming to the component creation schema.
4. WHEN the import file contains a component whose `slug` matches an existing Catalog entry, THE API SHALL present the Administrator with a conflict resolution interface showing the existing and incoming data side by side, with options to skip, overwrite, or merge.
5. THE API SHALL validate every row/object in the import file before persisting any data, and return a structured report listing: total rows, successfully imported, skipped (duplicate), failed (validation error), with per-row error details.
6. IF the import file contains more than 500 rows, THEN THE API SHALL process the import asynchronously and notify the Administrator via the Admin Panel when complete.
7. THE API SHALL expose `POST /api/admin/components/import` accepting `multipart/form-data` with a `file` field.

---

### Requirement 7: Admin Dashboard

**User Story:** As an Administrator, I want a dashboard overview of the platform's health and content, so that I can quickly assess the state of the catalog, scrapers, and price data.

#### Acceptance Criteria

1. THE Admin Panel SHALL display a Dashboard page as the default landing page after login, showing the following stats: total active components (by category), total retailers (active/inactive), last scraper run time and status, total price records, and number of unmatched listings pending review.
2. THE Admin Panel SHALL display a chart showing the number of price records updated per day over the past 30 days.
3. WHEN the Dashboard is loaded, THE API SHALL return all dashboard stats in a single `GET /api/admin/dashboard` request.
4. THE Admin Panel SHALL refresh dashboard stats automatically every 60 seconds while the page is open.
5. THE Admin Panel SHALL display a "Recent Activity" feed showing the last 10 admin actions (component created/updated/deleted, retailer toggled, import completed).

---

### Requirement 8: Component Management (Admin)

**User Story:** As an Administrator, I want full CRUD control over Canonical Components through the Admin Panel, so that I can keep the catalog accurate and up to date.

#### Acceptance Criteria

1. THE Admin Panel SHALL provide a component list view with search, filtering by category and active status, and sorting by name, brand, category, and last updated date.
2. WHEN an Administrator creates or edits a component, THE Admin Panel SHALL display a dynamic form that shows only the spec fields relevant to the selected category.
3. THE Admin Panel SHALL support uploading a component image, storing the image URL in the `image_url` field.
4. WHEN an Administrator deactivates a component, THE Admin Panel SHALL display a confirmation dialog warning that the component will be hidden from all public pages.
5. THE Admin Panel SHALL display, on each component's detail page, the list of current price offers and the number of scraper mappings linked to that component.
6. WHEN an Administrator deletes a component that has linked price records or scraper mappings, THEN THE API SHALL return HTTP 409 and require the Administrator to either reassign or delete the linked records first.

---

### Requirement 9: Improved User-Facing Interface

**User Story:** As a User, I want a modern, intuitive interface with search, filtering, and component detail pages, so that I can find and compare components efficiently.

#### Acceptance Criteria

1. THE Configurator SHALL replace the current dropdown selects with a searchable component picker that supports filtering by brand, socket, RAM type, and price range.
2. WHEN the User types in the component search field, THE Configurator SHALL display matching components within 300ms using debounced API calls.
3. THE Configurator SHALL display a component detail page accessible via a unique URL (`/components/:slug`) showing full specs, current price offers, and the price history chart.
4. THE Configurator SHALL display component thumbnail images where available, falling back to a category icon when no image is set.
5. THE Configurator SHALL implement client-side routing using React Router, with distinct routes for: home/configurator (`/`), component detail (`/components/:slug`), and build summary (`/build`).
6. WHEN the User selects a component in the Configurator, THE Configurator SHALL display a compact summary card showing the component's name, brand, image, and lowest current price.
7. THE Configurator SHALL display a "Compatible only" toggle per slot that, when enabled, filters the component list to show only components compatible with the current build selections.

---

### Requirement 10: Preset Builds

**User Story:** As a User, I want to browse curated PC builds for different budgets and use cases, so that I can get started quickly without selecting every component from scratch.

#### Acceptance Criteria

1. THE API SHALL expose `GET /api/builds/presets` returning a list of Preset Builds with fields: `id`, `name`, `description`, `use_case` (gaming, workstation, office, budget), `total_price_estimate`, `components`.
2. THE Admin Panel SHALL allow Administrators to create, edit, and delete Preset Builds by selecting components from the Catalog and assigning a name, description, and use case tag.
3. WHEN a User selects a Preset Build, THE Configurator SHALL load all components from the preset into the active build slots and run compatibility validation.
4. THE Configurator SHALL display Preset Builds on the home page in a dedicated section, grouped by use case.
5. WHEN a Preset Build contains a component that is no longer active in the Catalog, THE API SHALL exclude that component from the preset's component list and flag the preset as `incomplete`.

---

### Requirement 11: Authentication and Session Management

**User Story:** As an Administrator, I want a proper login page with secure session management, so that the admin panel is protected and usable as a real application.

#### Acceptance Criteria

1. THE Admin Panel SHALL include a dedicated login page at `/admin/login` with email and password fields.
2. WHEN an Administrator submits valid credentials, THE API SHALL return a JWT access token (15-minute expiry) and a refresh token (7-day expiry) stored in an `HttpOnly` cookie.
3. WHEN the JWT access token expires, THE Admin Panel SHALL automatically request a new access token using the refresh token without requiring the Administrator to log in again.
4. IF the refresh token is expired or invalid, THEN THE Admin Panel SHALL redirect the Administrator to the login page.
5. THE Admin Panel SHALL provide a logout action that invalidates the refresh token server-side and clears the `HttpOnly` cookie.
6. THE API SHALL expose `POST /api/auth/refresh` for token renewal and `POST /api/auth/logout` for session termination.

---

### Requirement 12: Deployment Readiness

**User Story:** As a developer, I want the platform to be deployable to a Linux VPS with minimal configuration, so that it can be hosted publicly for real users.

#### Acceptance Criteria

1. THE backend SHALL read all environment-specific configuration (database URL, JWT secret, port, allowed origins) from environment variables, with no hardcoded values.
2. THE backend SHALL expose a `GET /api/health` endpoint returning HTTP 200 with a JSON body `{ "status": "ok", "timestamp": "<ISO8601>" }` for use by load balancers and uptime monitors.
3. THE frontend build SHALL be configurable via a `VITE_API_BASE_URL` environment variable so that the same build artifact can target different backend URLs.
4. THE repository SHALL include a `docker-compose.yml` file defining services for the backend (Bun), the PostgreSQL database, and an Nginx reverse proxy serving the frontend static files.
5. THE repository SHALL include a `.env.example` file listing all required environment variables with placeholder values and inline comments.
6. THE backend SHALL serve the frontend's static build output when `NODE_ENV=production` and `SERVE_STATIC=true` are set, eliminating the need for a separate static file server in simple deployments.

---

### Requirement 13: Performance and Scalability

**User Story:** As a User, I want the platform to respond quickly even when many components and price records exist, so that the experience remains smooth as the catalog grows.

#### Acceptance Criteria

1. THE API SHALL return component list responses in under 300ms for catalogs of up to 1,000 components under normal load.
2. THE database schema SHALL include indexes on: `components(category)`, `components(slug)`, `prices(component_id)`, `price_history(component_id, recorded_at)`, and `scraper_mappings(component_id, retailer_id)`.
3. THE API SHALL support pagination on all list endpoints using `page` and `limit` query parameters, with a default page size of 20 and a maximum of 100.
4. WHEN the `limit` parameter exceeds 100, THE API SHALL return HTTP 400 with an error indicating the maximum allowed value.
5. THE API SHALL return a `X-Total-Count` response header on all paginated list endpoints indicating the total number of matching records.

---

### Requirement 14: Data Integrity and Error Handling

**User Story:** As a developer, I want the system to handle errors gracefully and maintain data consistency, so that the platform remains reliable in production.

#### Acceptance Criteria

1. THE API SHALL use database transactions for all multi-step write operations (e.g., bulk import, preset creation) to ensure atomicity.
2. IF a database transaction fails, THEN THE API SHALL roll back all changes and return an appropriate error response without partial data being persisted.
3. THE API SHALL validate all incoming request bodies against Zod schemas before any database interaction, returning HTTP 400 with field-level error details on validation failure.
4. WHEN the Scraper encounters a network timeout or HTTP error from a retailer, THE Scraper SHALL retry the request up to 3 times with exponential backoff before logging the failure and continuing.
5. THE API SHALL return consistent error responses in the format `{ "error": { "code": "ERROR_CODE", "message": "...", "fields": [] } }` for all error conditions.
