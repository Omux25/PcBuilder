# Glossary

Key terms used throughout the PC Builder Maroc codebase and documentation.

---

## A

**Aggregator** — The module (`backend/scraper/aggregator.ts`) that processes scraped prices. For each scraped product URL, it looks up the `scraper_mappings` table to find the matching catalog component, then UPSERTs the price into the `prices` table.

**AppError** — The custom error class (`backend/src/utils/errors.ts`) used throughout the backend. Carries an error code, HTTP status, and message. The global error handler in `app.ts` converts these to the standard JSON error shape.

**autoMap** — The function (`backend/scraper/autoMapper.ts`) that runs the DNA matcher against all pending `unmatched_listings` and creates `scraper_mappings` entries for confident matches.

---

## B

**BaseScraper** — The abstract base class (`backend/scraper/scrapers/baseScraper.ts`) that all site-specific scrapers extend. Handles HTTP fetch, HTML parsing, and retry logic.

**buildFromUnmatched** — The function (`backend/scraper/catalogBuilder.ts`) that auto-creates catalog entries from scraped product names that couldn't be matched by `autoMap`.

**Bun.sql** — The built-in PostgreSQL client in Bun. Uses tagged template literals for parameterized queries. Accessed via `getSql()` from `backend/src/db/index.ts`.

---

## C

**catalogBuilder** — See `buildFromUnmatched`.

**compatible** — The boolean field in the compatibility API response. `true` only when the `errors` array is empty. Warnings do not affect this field.

**ComponentCategory** — One of 8 values: `cpu`, `motherboard`, `gpu`, `ram`, `storage`, `psu`, `case`, `cooling`. Defined in `backend/src/schemas/componentSchemas.ts`.

---

## D

**DI (Dependency Injection)** — The pattern used for database access in tests. `getSql()` returns the current SQL function, which can be replaced with a mock via `setSql()`. All route handlers and services use `getSql()` — never `import { sql } from 'bun'` directly.

**DNA matching** — The technique used by `componentMatcher.ts` to link scraped product names to catalog components. Extracts minimal identifying tokens ("DNA") per category and requires all tokens to match.

**DNA tokens** — The minimal set of identifiers that uniquely describe a component within its category. Examples: `["rtx4090"]` for a GPU, `["ryzen5", "7600x"]` for a CPU.

---

## E

**ESM (ECMAScript Modules)** — The module system used throughout the project. `import`/`export` syntax, `.js` extensions in import paths, `"type": "module"` in `package.json`.

---

## G

**getSql()** — The centralized database accessor in `backend/src/db/index.ts`. Returns the current SQL tagged template function. Supports dependency injection for tests.

---

## H

**Hono** — The web framework used for the backend. TypeScript-first, faster than Express, runs natively on Bun.

---

## J

**JWT (JSON Web Token)** — The access token format used for admin authentication. Signed with `JWT_SECRET`, expires in 15 minutes. Verified by `authMiddleware`.

---

## M

**Migration** — A numbered SQL file in `backend/src/db/migrations/` that modifies the database schema. Run in order (001–019) to produce the full schema. All migrations use `IF NOT EXISTS` guards.

---

## P

**PBT (Property-Based Testing)** — Testing technique using `fast-check` to generate hundreds of random inputs and verify that a property holds for all of them. Used for compatibility rules, slug generation, and import handling.

**preset build** — A curated PC configuration created by admins. Stored in `preset_builds` and `preset_build_components` tables. Accessible via `GET /api/builds/presets`.

**price history** — The append-only log of price changes in the `price_history` table. A new row is inserted every time a scraped price differs from the last recorded price.

---

## R

**refresh token** — A 7-day token stored as an HttpOnly cookie. Used to get new access tokens without re-logging in. The raw token is in the cookie; only its SHA-256 hash is stored in the database.

**RULE_LABELS** — A `Record<string, string>` in `frontend/src/types.ts` mapping compatibility rule keys (e.g. `socket_mismatch`) to French display labels shown in the UI.

---

## S

**scraper_mappings** — The table linking retailer product URLs to catalog components. When the aggregator finds a URL in this table, it knows which component to update. When it doesn't, the product goes to `unmatched_listings`.

**ScrapedPrice** — The interface returned by all scrapers. Contains `retailer_id`, `price`, `in_stock`, `product_url`, and `product_name` (the optional raw scraped product title used for DNA matching and unmatched listings).

**slug** — A URL-safe identifier derived from brand + name. Example: `amd-ryzen-7-7700x`. Unique across all components. Used in frontend URLs.

---

## T

**TDP (Thermal Design Power)** — Maximum heat output in watts. Used to calculate recommended PSU wattage: `ceil(total_tdp × 1.5)`.

---

## U

**unmatched_listings** — Products found by scrapers that couldn't be matched to any catalog component. Admins review these in the admin panel and either link them to a component or dismiss them.

---

## V

**variant** — A specific product listing at a retailer. The same component can have multiple variants at the same retailer (e.g. different AIB partners for a GPU). Each variant has its own `product_url`, `variant_label`, and `variant_details`.

**variant_details** — JSONB column in the `prices` table storing structured metadata about a variant (e.g. `{ "aib_partner": "Sapphire", "model_tier": "Pulse" }`).

**variantExtractor** — The module (`backend/src/utils/variantExtractor.ts`) that extracts human-readable variant labels and structured details from scraped product names.
