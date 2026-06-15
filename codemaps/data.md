# Data Models & Schemas Codemap

**Freshness Timestamp:** 2026-06-15T16:10:00Z

## Database Schema (PostgreSQL)

### `components`
Stores standard hardware definitions (e.g. CPU, GPU, motherboard specs promoted to typed columns for speed).

### `prices`
Listings scraped from partners. Points to a `retailer_id` and a `component_id`.

### `shared_builds`
Holds shortened configurations for social shares.
- `id` (VARCHAR(10) PRIMARY KEY): Alphanumeric code (e.g. `x7b2f9`).
- `config_json` (JSONB NOT NULL): Map of active slot keys to component IDs (e.g. `{"cpu": 12, "gpu": 34, "ram_1": 56}`).
- `created_at` (TIMESTAMPTZ DEFAULT NOW()): Creation timestamp.

### `admins`
Stores username and bcrypt hashes for admin verification.

### `traffic_logs`
Logs incoming requests, response codes, times, and page types.
