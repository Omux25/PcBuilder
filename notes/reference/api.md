# API Reference

Complete reference for all HTTP endpoints. Base URL: `http://localhost:3000` in development.

All error responses follow this shape:
```json
{ "error": { "code": "ERROR_CODE", "message": "Human-readable message", "fields": [] } }
```
`fields` is only present on HTTP 400 validation errors.

---

## Public routes

No authentication required.

---

### `GET /api/health`

Health check.

**Response 200:**
```json
{ "status": "ok", "timestamp": "2026-04-28T10:00:00.000Z" }
```

---

### `GET /api/components`

Paginated list of active components.

**Query parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `category` | string | — | Filter: `cpu`, `motherboard`, `gpu`, `ram`, `storage`, `psu`, `case`, `cooling` |
| `socket` | string | — | Filter by socket (e.g. `AM5`, `LGA1700`) |
| `ram_type` | string | — | Filter by RAM type (`DDR4`, `DDR5`) |
| `brand` | string | — | Filter by brand (e.g. `AMD`, `Intel`) |
| `search` | string | — | Full-text search across name, brand, slug |
| `ids` | string | — | Comma-separated list of component IDs for batch lookup (e.g. `1,2,3`). When provided, bypasses pagination and returns only those components. Used by the frontend to restore builds from URL. Max 50 IDs — returns `400` if exceeded. |
| `page` | integer | 1 | Page number |
| `limit` | integer | 20 | Items per page (max 100) |

**Response headers:**
- `X-Total-Count: 305` — total matching components (for pagination)

**Response 200:**
```json
{
  "components": [
    {
      "id": 1,
      "name": "Ryzen 7 7700X",
      "brand": "AMD",
      "category": "cpu",
      "slug": "amd-ryzen-7-7700x",
      "socket": "AM5",
      "tdp": 105,
      "specs": { "cores": 8, "threads": 16, "base_clock_ghz": 4.5, "boost_clock_ghz": 5.4 },
      "image_url": "https://...",
      "release_year": 2022,
      "is_active": true
    }
  ],
  "total": 305
}
```

**Errors:**
- `400` — `limit > 100`

---

### `GET /api/components/slug/:slug`

Single component by URL slug.

**Response 200:** Full component object (same shape as above).

**Errors:**
- `404` — slug not found or component is inactive

---

### `GET /api/components/:id`

Single component by numeric ID.

**Response 200:** Full component object.

**Errors:**
- `400` — id is not a positive integer
- `404` — component not found or inactive

---

### `GET /api/components/:id/prices`

All current price offers for a component. Sorted: in-stock first, then by price ascending.

**Response 200:**
```json
{
  "offers": [
    {
      "retailer_id": 10,
      "retailer_name": "UltraPC",
      "price": 4299.00,
      "in_stock": true,
      "product_url": "https://ultrapc.ma/...",
      "last_updated": "2026-04-28T10:00:00Z",
      "variant_label": "Sapphire Pulse",
      "variant_details": { "aib_partner": "Sapphire", "model_tier": "Pulse" }
    }
  ]
}
```

When no offers exist, `offers` is an empty array.

**Errors:**
- `400` — id is not a positive integer
- `404` — component not found

---

### `GET /api/components/:id/price-history`

Price history for a component.

**Query parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `retailer_id` | integer | — | Filter to one retailer |
| `days` | integer | 30 | How many days back to look |

**Response 200:**
```json
{
  "component_id": 42,
  "history": [
    {
      "retailer_id": 10,
      "retailer_name": "UltraPC",
      "price": 4299.00,
      "in_stock": true,
      "recorded_at": "2026-04-28T00:00:00Z"
    }
  ]
}
```

---

### `POST /api/components/smart-search`

Search with compatibility filtering and price data. Used by the ComponentPicker in the configurator.

**Request body (JSON):**
```json
{
  "build": {
    "cpu": { "socket": "AM5", "tdp": 105 }
  }
}
```

**Query parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| `category` | string | yes | Category to search within |
| `search` | string | — | Search term |
| `brand` | string | — | Filter by brand |
| `socket` | string | — | Filter by socket |
| `ram_type` | string | — | Filter by RAM type |
| `page` | integer | — | Page number |
| `limit` | integer | — | Items per page |

**Response 200:**
```json
{
  "components": [
    {
      "id": 1,
      "name": "Ryzen 7 7700X",
      "brand": "AMD",
      "category": "cpu",
      "slug": "amd-ryzen-7-7700x",
      "lowest_price": 2199.00,
      "in_stock": true,
      "compatibility": "compatible",
      "compatibility_issues": []
    }
  ],
  "total": 12
}
```

`compatibility` is one of `"compatible"`, `"incompatible"`, or `"unknown"`. `"unknown"` means no other components are in the build yet, so no rules could fire. `compatibility_issues` contains the error messages for incompatible components.

**Errors:**
- `400` — category is missing or build is invalid JSON

---

### `POST /api/compatibility/validate`

Validate a PC build. All components are optional — only rules where both required components are present will fire.

Multi-slot support: RAM and storage can occupy multiple slots using indexed keys (`ram_1`, `ram_2`, `storage_1`, `storage_2`, etc.). Legacy bare `ram` and `storage` keys are also accepted.

**Request body:**
```json
{
  "cpu":         { "socket": "AM5", "tdp": 105 },
  "motherboard": { "socket": "AM5", "supported_ram_types": ["DDR5"], "max_ram_frequency": 6000, "ram_slots": 4, "m2_slots": 2, "sata_ports": 4, "tdp": 15 },
  "gpu":         { "length_mm": 336, "tdp": 320 },
  "ram_1":       { "ram_type": "DDR5", "frequency_mhz": 6000, "tdp": 5 },
  "ram_2":       { "ram_type": "DDR5", "frequency_mhz": 6000, "tdp": 5 },
  "storage_1":   { "tdp": 3 },
  "psu":         { "wattage": 850 },
  "case":        { "max_gpu_length_mm": 400 }
}
```

**Response 200:**
```json
{
  "compatible": true,
  "total_tdp": 453,
  "recommended_psu_wattage": 680,
  "errors": [],
  "warnings": []
}
```

**Compatibility rules:**

| Rule | Type | Fires when |
|---|---|---|
| `socket_mismatch` | error | `cpu.socket` ≠ `motherboard.socket` |
| `ram_type_mismatch` | error | any RAM stick's `ram_type` not in `motherboard.supported_ram_types` |
| `ram_frequency_exceeded` | warning | any RAM stick's `frequency_mhz` > `motherboard.max_ram_frequency` |
| `gpu_too_long` | error | `gpu.length_mm` > `case.max_gpu_length_mm` |
| `form_factor_mismatch` | error | `motherboard.form_factor` not in `case.supported_motherboards` |
| `cooler_too_tall` | error | `cooling.height_mm` > `case.max_cooler_height_mm` |
| `ram_slots_exceeded` | error | count of RAM sticks > `motherboard.ram_slots` (skipped if `ram_slots` is null) |
| `storage_slots_exceeded` | error | count of storage drives > `motherboard.m2_slots + motherboard.sata_ports` (skipped if both are null) |
| `psu_underpowered` | warning | `psu.wattage` < `ceil(total_tdp × 1.5)` |

**Errors:**
- `400` — body is not valid JSON or not an object

---

### `GET /api/builds/presets`

List all active preset builds.

**Query parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `use_case` | string | — | Filter by use case: `gaming`, `workstation`, `office`, `budget` |

**Response 200:**
```json
{
  "presets": [
    {
      "id": 1,
      "name": "Budget Gaming Build",
      "description": "A solid entry-level gaming PC",
      "use_case": "gaming",
      "total_price_estimate": 8500.00,
      "is_active": true,
      "incomplete": false,
      "components": {
        "cpu":       { "id": 10, "slug": "amd-ryzen-5-7600x", "name": "Ryzen 5 7600X", "brand": "AMD", "image_url": null, "is_active": true },
        "gpu":       { "id": 42, "slug": "nvidia-rtx-4070", "name": "RTX 4070", "brand": "NVIDIA", "image_url": null, "is_active": true },
        "ram_1":     { "id": 55, "slug": "corsair-vengeance-ddr5-32gb", "name": "Vengeance DDR5 32GB", "brand": "Corsair", "image_url": null, "is_active": true },
        "ram_2":     { "id": 56, "slug": "corsair-vengeance-ddr5-32gb-2", "name": "Vengeance DDR5 32GB", "brand": "Corsair", "image_url": null, "is_active": true },
        "storage_1": { "id": 70, "slug": "samsung-990-pro-1tb", "name": "990 Pro 1TB", "brand": "Samsung", "image_url": null, "is_active": true }
      },
      "created_at": "2026-04-01T00:00:00Z",
      "updated_at": "2026-04-01T00:00:00Z"
    }
  ]
}
```

`incomplete` is `true` when at least one component in the preset has `is_active = false` (deactivated from the catalog). The preset is still returned — the frontend can warn the user.

---

### `GET /api/builds/presets/:id`

Single preset build by numeric ID.

**Response 200:** Full preset object (same shape as above, unwrapped — not in an array).

**Errors:**
- `400` — id is not a positive integer
- `404` — preset not found

---

### `GET /api/market-trends`

Components whose price has changed significantly over a recent window. Used by the Market Trends page to show price drops and hikes.

**Query parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `type` | string | `drops` | `drops` (price decreased) or `hikes` (price increased) |
| `days` | integer | `7` | Lookback window in days (min 1, max 30) |
| `limit` | integer | `20` | Max results to return (min 1, max 50) |
| `category` | string | — | Filter by component category |

**Response 200:**
```json
{
  "trends": [
    {
      "component_id": 42,
      "name": "RTX 4070 Ti",
      "brand": "NVIDIA",
      "slug": "nvidia-rtx-4070-ti",
      "category": "gpu",
      "image_url": null,
      "price_before": 4500.00,
      "price_after": 3999.00,
      "diff_amount": 501.00,
      "change_pct": 11.1,
      "type": "drops"
    }
  ],
  "days": 7,
  "type": "drops",
  "total": 1
}
```

- `price_before` — cheapest in-stock price on the first day of the window
- `price_after` — cheapest in-stock price on the last day of the window
- `diff_amount` — absolute price difference (always positive)
- `change_pct` — percentage change, rounded to 1 decimal place
- Only components currently in stock are included
- Invalid `days` or `limit` values fall back to defaults (no 400 error)

---

### `POST /api/auth/login`

Admin login.

**Request body:**
```json
{ "username": "admin", "password": "admin123" }
```

**Response 200:**
```json
{ "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...", "expires_in": 900 }
```

Also sets an HttpOnly cookie: `refresh_token=<hex>; HttpOnly; SameSite=Strict; Max-Age=604800`

**Errors:**
- `401` — invalid credentials (same message for wrong username or wrong password)
- `429` — rate limited (10 attempts/IP/minute)

---

### `POST /api/auth/refresh`

Get a new access token using the refresh cookie.

**Response 200:**
```json
{ "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...", "expires_in": 900 }
```

**Errors:**
- `401` — no refresh cookie, invalid token, or token expired

---

### `POST /api/auth/logout`

Invalidate the refresh token and clear the cookie.

**Response 200:**
```json
{ "success": true }
```

---

## Protected routes

All protected routes require: `Authorization: Bearer <access_token>`

Returns `401` if the token is missing, expired, or invalid.

---

### `GET /api/admin/dashboard`

Dashboard stats, price chart, and recent activity.

**Response 200:**
```json
{
  "stats": {
    "total_components": 305,
    "components_by_category": { "cpu": 45, "gpu": 60, "ram": 40, "motherboard": 35, "storage": 50, "psu": 30, "case": 25, "cooling": 20 },
    "total_retailers": 3,
    "active_retailers": 3,
    "total_price_records": 1240,
    "unmatched_listings_count": 47,
    "last_scrape": {
      "time": "2026-04-28T10:00:00Z",
      "status": "SUCCESS"
    }
  },
  "price_updates_chart": [
    { "date": "2026-04-28", "count": 312 }
  ],
  "recent_activity": [
    { "id": 1, "admin_id": 1, "action": "component_created", "entity_type": "component", "entity_id": 42, "created_at": "..." }
  ]
}
```

---

### `GET /api/admin/components`

List all components including inactive ones. Supports same filters as the public endpoint plus `is_active`.

### `POST /api/admin/components`

Create a component. Body must include `category` and all required fields for that category.

**Response 201:** Created component object.

### `PUT /api/admin/components/:id`

Update a component. Partial updates supported.

**Response 200:** Updated component object.

### `DELETE /api/admin/components/:id`

Delete a component. Returns `409` if the component has linked prices or scraper mappings — use the deactivate endpoint instead.

### `POST /api/admin/components/:id/deactivate`

Soft-delete a component: sets `is_active = false`. The component is hidden from the public API but its price history, scraper mappings, and prices are preserved. Use this when `DELETE` returns `409`.

**Response 200:**
```json
{ "message": "Component 42 deactivated successfully.", "component": { ... } }
```

**Errors:**
- `400` — id is not a positive integer
- `404` — component not found

### `POST /api/admin/components/import`

Bulk import from CSV or JSON.

**Request:** `multipart/form-data` with a `file` field.

**Response 200:**
```json
{ "total_rows": 48, "imported": 45, "skipped": 2, "failed": 1, "errors": [{ "row": 12, "message": "socket is required for cpu" }] }
```

---

### `GET /api/admin/retailers`

List all retailers with scraping stats.

### `POST /api/admin/retailers`

Create a retailer.

### `PUT /api/admin/retailers/:id`

Update a retailer.

### `DELETE /api/admin/retailers/:id`

Deactivate a retailer (sets `is_active = false`). Does not delete data.

---

### `GET /api/admin/scrapers/status`

Check whether a scraping session is currently running. Used by the admin panel to sync UI state on page load.

**Response 200:**
```json
{ "running": false, "running_jobs": [] }
```

- `running` — `true` if any session (full or targeted) is active
- `running_jobs` — array of retailer IDs currently being scraped individually

### `POST /api/admin/scrapers/:retailerId/run`

Trigger an immediate scrape for one retailer.

**Response 200:**
```json
{ "status": "started", "retailer_id": 10 }
```

**Errors:**
- `409` — scrape already running for this retailer

### `POST /api/admin/scrapers/run-all`

Trigger all active retailers sequentially.

**Response 200:**
```json
{ "message": "Full scraping session started", "status": "started" }
```

**Errors:**
- `409` — a full scraping session is already running

---

### `GET /api/admin/unmatched-listings`

List unmatched product listings.

**Query parameters:** `status` (pending/linked/dismissed), `retailer_id`, `page` (default 1), `limit` (default 50, max 200)

**Response headers:**
- `X-Total-Count: 47` — total matching listings (for pagination)

**Response 200:**
```json
{ "listings": [...], "total": 47 }
```

### `POST /api/admin/unmatched-listings/:id/link`

Link an unmatched listing to a catalog component. Creates a `scraper_mappings` entry.

**Request body:** `{ "component_id": 42 }`

### `POST /api/admin/unmatched-listings/:id/dismiss`

Mark a listing as dismissed.

---

### `GET /api/admin/logs`

Query scraper logs.

**Query parameters:** `level` (INFO/WARNING/ERROR), `site`, `limit` (default 100, max 10000)

**Response 200:**
```json
{
  "logs": [
    { "id": 1, "level": "INFO", "site": "ultrapc.ma", "message": "Session complete: 312 updated, 0 errors", "created_at": "..." }
  ],
  "count": 1
}
```
