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
| `ids` | string | — | Comma-separated list of component IDs for batch lookup (e.g. `1,2,3`). When provided, bypasses pagination and returns only those components. Used by the frontend to restore builds from URL. |
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

**Request body:**
```json
{
  "cpu":         { "socket": "AM5", "tdp": 105 },
  "motherboard": { "socket": "AM5", "supported_ram_types": ["DDR5"], "max_ram_frequency": 6000, "tdp": 15 },
  "gpu":         { "length_mm": 336, "tdp": 320 },
  "ram":         { "ram_type": "DDR5", "frequency_mhz": 6000, "tdp": 5 },
  "psu":         { "wattage": 850 },
  "case":        { "max_gpu_length_mm": 400 }
}
```

**Response 200:**
```json
{
  "compatible": true,
  "total_tdp": 445,
  "recommended_psu_wattage": 534,
  "errors": [],
  "warnings": []
}
```

**Errors:**
- `400` — body is not valid JSON or not an object

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
    "components_by_category": { "cpu": 45, "gpu": 60 },
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

**Query parameters:** `status` (pending/linked/dismissed), `retailer_id`

### `POST /api/admin/unmatched-listings/:id/link`

Link an unmatched listing to a catalog component. Creates a `scraper_mappings` entry.

**Request body:** `{ "component_id": 42 }`

### `POST /api/admin/unmatched-listings/:id/dismiss`

Mark a listing as dismissed.

---

### `GET /api/admin/logs`

Query scraper logs.

**Query parameters:** `level` (INFO/WARNING/ERROR), `site`, `limit` (default 100, max 500)

**Response 200:**
```json
{
  "logs": [
    { "id": 1, "level": "INFO", "site": "ultrapc.ma", "message": "Session complete: 312 updated, 0 errors", "created_at": "..." }
  ],
  "count": 1
}
```
