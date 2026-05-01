# Database Reference

All 13 application tables in the PostgreSQL database, plus the internal `_migrations` tracking table. Migration files are in `backend/src/db/migrations/` (001–019).

---

## How migrations work

Each migration is a numbered SQL file. Run them in order on a fresh database to produce the exact schema. All scripts use `IF NOT EXISTS` — safe to run multiple times.

The migration runner (`backend/src/db/migrate.ts`) also creates a `_migrations` table to track which files have already been applied, making it safe to re-run without re-applying completed migrations.

```bash
# Run all migrations (WSL2)
psql -U pc_builder_user -d pc_builder -f backend/src/db/migrations/001_create_components.sql
psql -U pc_builder_user -d pc_builder -f backend/src/db/migrations/002_create_retailers.sql
# ... continue through 019
```

---

## Table 1: `components` (001, expanded in 006)

The central table. Stores all 8 component categories in a single polymorphic table.

| Column | Type | Notes |
|---|---|---|
| `id` | SERIAL PK | Auto-incrementing |
| `name` | VARCHAR(255) NOT NULL | Product name |
| `brand` | VARCHAR(100) | Manufacturer |
| `category` | VARCHAR(50) NOT NULL | One of 8 categories (CHECK constraint) |
| `slug` | VARCHAR(300) UNIQUE | URL-safe identifier, auto-generated |
| `description` | TEXT | Optional marketing description |
| `specs` | JSONB | Category-specific structured specs |
| `image_url` | VARCHAR(500) | Product image URL |
| `release_year` | INTEGER | Year released |
| `is_active` | BOOLEAN DEFAULT true | False = hidden from public API |
| `created_at` | TIMESTAMPTZ | Auto-set on insert |
| `updated_at` | TIMESTAMPTZ | Auto-updated on change |

Compatibility fields (NULL when not applicable): `socket`, `supported_ram_types`, `max_ram_frequency`, `ram_type`, `frequency_mhz`, `length_mm`, `max_gpu_length_mm`, `supported_motherboards`, `max_cooler_height_mm`, `form_factor`, `height_mm`, `wattage`, `tdp`, `benchmark_score`.

> `supported_motherboards`, `max_cooler_height_mm`, `form_factor`, and `height_mm` were added in migration 019 to support Rules 5 (form_factor_mismatch) and 6 (cooler_too_tall).

Indexes: `category`, `slug`, `brand`, `is_active`

---

## Table 2: `retailers` (002, expanded in 007)

Moroccan e-commerce sites that sell PC components.

| Column | Type | Notes |
|---|---|---|
| `id` | SERIAL PK | |
| `name` | VARCHAR(100) UNIQUE | e.g. "UltraPC" |
| `base_url` | VARCHAR(255) | e.g. "https://ultrapc.ma" |
| `logo_url` | VARCHAR(500) | |
| `country` | VARCHAR(50) | e.g. "MA" |
| `is_active` | BOOLEAN DEFAULT true | Inactive = skipped by scheduler |
| `scraping_interval_hours` | INTEGER DEFAULT 24 | How often to scrape |
| `last_scrape_at` | TIMESTAMPTZ | When the last scrape ran |
| `last_scrape_status` | VARCHAR(20) | `SUCCESS`, `PARTIAL`, or `FAILED` |
| `notes` | TEXT | Admin notes |

Active retailers: UltraPC (id=10), NextLevel (id=11), SetupGame (id=13)

---

## Table 3: `prices` (003, modified in 014)

Current prices — one row per (component, retailer, product URL).

| Column | Type | Notes |
|---|---|---|
| `id` | SERIAL PK | |
| `component_id` | INTEGER FK → components | ON DELETE CASCADE |
| `retailer_id` | INTEGER FK → retailers | ON DELETE CASCADE |
| `price` | NUMERIC(10,2) | Price in MAD |
| `in_stock` | BOOLEAN DEFAULT false | |
| `product_url` | VARCHAR(500) | Direct link to product page |
| `last_updated` | TIMESTAMPTZ | When this price was last scraped |
| `variant_label` | VARCHAR(255) | Human-readable variant (e.g. "Sapphire Pulse") |
| `variant_details` | JSONB | Structured variant metadata |

Unique constraint: `(component_id, retailer_id, product_url)` — one row per distinct product URL.

Migration 014 changed the old `(component_id, retailer_id)` unique constraint to include `product_url`, enabling multiple variants of the same component at the same retailer.

---

## Table 4: `scraper_logs` (004)

Structured log entries from the scraping system.

| Column | Type | Notes |
|---|---|---|
| `id` | SERIAL PK | |
| `level` | VARCHAR(10) | INFO, WARNING, or ERROR |
| `site` | VARCHAR(100) | Retailer site name |
| `message` | TEXT | Log message |
| `created_at` | TIMESTAMPTZ | |

Indexes: `created_at`, `level`, `site`

---

## Table 5: `admins` (005)

Admin user accounts.

| Column | Type | Notes |
|---|---|---|
| `id` | SERIAL PK | |
| `username` | VARCHAR(100) UNIQUE | |
| `password_hash` | VARCHAR(255) | bcrypt hash — never plain text |
| `created_at` | TIMESTAMPTZ | |

---

## Table 6: `scraper_mappings` (008)

Links a retailer product URL to a catalog component. This is how the aggregator knows which component a scraped product belongs to.

| Column | Type | Notes |
|---|---|---|
| `id` | SERIAL PK | |
| `component_id` | INTEGER FK → components | |
| `retailer_id` | INTEGER FK → retailers | |
| `product_url` | VARCHAR(500) | The exact URL scraped |
| `product_identifier` | VARCHAR(255) | Optional internal ID (e.g. PrestaShop product ID) |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

Unique constraint: `(retailer_id, product_url)`

When the aggregator finds a product URL in this table, it knows which component to update. When it doesn't find a match, the product goes into `unmatched_listings`.

---

## Table 7: `price_history` (009)

Append-only price history. A new row is inserted every time a price changes.

| Column | Type | Notes |
|---|---|---|
| `id` | SERIAL PK | |
| `component_id` | INTEGER FK → components | |
| `retailer_id` | INTEGER FK → retailers | |
| `price` | NUMERIC(10,2) | Price at this point in time |
| `in_stock` | BOOLEAN | |
| `recorded_at` | TIMESTAMPTZ | When this price was recorded |

Index: `(component_id, recorded_at DESC)` — fast lookups for the price history chart.

This table never updates — it only grows. It's the source of data for the price history chart on the component detail page.

---

## Table 8: `preset_builds` (010)

Pre-configured PC builds curated by admins.

| Column | Type | Notes |
|---|---|---|
| `id` | SERIAL PK | |
| `name` | VARCHAR(255) | e.g. "Budget Gaming Build" |
| `description` | TEXT | |
| `use_case` | VARCHAR(50) | gaming, workstation, office |
| `total_price_estimate` | NUMERIC(10,2) | Approximate total cost |
| `is_active` | BOOLEAN DEFAULT true | |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

---

## Table 9: `preset_build_components` (010)

Links components to preset builds. One row per (preset, category) — each preset has at most one component per category.

| Column | Type | Notes |
|---|---|---|
| `id` | SERIAL PK | |
| `preset_build_id` | INTEGER FK → preset_builds | ON DELETE CASCADE |
| `component_id` | INTEGER FK → components | |
| `category` | VARCHAR(50) | |

Unique constraint: `(preset_build_id, category)`

---

## Table 10: `unmatched_listings` (011)

Products found by scrapers that couldn't be matched to any catalog component.

| Column | Type | Notes |
|---|---|---|
| `id` | SERIAL PK | |
| `retailer_id` | INTEGER FK → retailers | |
| `product_url` | VARCHAR(500) | |
| `scraped_name` | TEXT | Raw product title from the retailer |
| `scraped_price` | NUMERIC(10,2) | |
| `scraped_at` | TIMESTAMPTZ | |
| `status` | VARCHAR(20) DEFAULT 'pending' | pending, linked, dismissed |
| `linked_component_id` | INTEGER FK → components | Set when status = linked |

Admins review these in the admin panel and either link them to a component (creating a `scraper_mappings` entry) or dismiss them.

---

## Table 11: `admin_activity_log` (012)

Audit trail of all admin actions.

| Column | Type | Notes |
|---|---|---|
| `id` | SERIAL PK | |
| `admin_id` | INTEGER FK → admins | |
| `action` | VARCHAR(50) | created, updated, deleted, linked, dismissed |
| `entity_type` | VARCHAR(50) | component, retailer, listing, preset |
| `entity_id` | INTEGER | ID of the affected record |
| `details` | JSONB | Additional context (e.g. component name) |
| `created_at` | TIMESTAMPTZ | |

Index: `created_at DESC`

---

## Table 12: `refresh_tokens` (013)

Stores hashed refresh tokens for the admin authentication system.

| Column | Type | Notes |
|---|---|---|
| `id` | SERIAL PK | |
| `admin_id` | INTEGER FK → admins | |
| `token` | VARCHAR(255) | Hash of the raw token (not the raw token itself) |
| `expires_at` | TIMESTAMPTZ | 7 days after creation |
| `created_at` | TIMESTAMPTZ | |

Indexes: `token`, `expires_at`

The raw token is stored in an HttpOnly cookie on the client. The database stores only the hash. If the database is compromised, the hashes cannot be reversed.

---

## Entity relationships

```
components ──< prices >── retailers
components ──< scraper_mappings >── retailers
components ──< price_history >── retailers
components ──< preset_build_components >── preset_builds
components ──< unmatched_listings >── retailers
admins ──< refresh_tokens
admins ──< admin_activity_log
```

All foreign keys use `ON DELETE CASCADE` where appropriate — deleting a component removes its prices, mappings, and history automatically.
