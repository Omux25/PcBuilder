# Component Catalog

The component catalog is the database of PC parts that users can select when building a PC. It covers 8 categories, supports rich metadata, and is searchable with pagination.

---

## The 8 categories

| Category | Example | Key fields |
|---|---|---|
| `cpu` | AMD Ryzen 7 7700X | socket, tdp |
| `motherboard` | ASUS ROG Strix B650E | socket, supported_ram_types, max_ram_frequency |
| `gpu` | NVIDIA RTX 4090 | length_mm, tdp, vram_gb |
| `ram` | Corsair Vengeance DDR5-6000 | ram_type, frequency_mhz, capacity_gb |
| `storage` | Samsung 990 Pro 1TB | type (NVMe/SATA), capacity_gb |
| `psu` | Seasonic Focus GX-850 | wattage, efficiency_rating |
| `case` | Fractal Design Meshify 2 | max_gpu_length_mm, form_factor |
| `cooling` | Noctua NH-D15 | tdp (cooling capacity) |

All 8 categories are stored in a single `components` table. Category-specific fields are `NULL` when they don't apply.

---

## Component fields

Every component has these base fields:

| Field | Type | Description |
|---|---|---|
| `id` | integer | Auto-incrementing primary key |
| `name` | text | Product name (e.g. "Ryzen 7 7700X") |
| `brand` | text | Manufacturer (e.g. "AMD") |
| `category` | text | One of the 8 categories above |
| `slug` | text | URL-safe identifier (e.g. "amd-ryzen-7-7700x") |
| `description` | text | Optional marketing description |
| `specs` | JSONB | Category-specific specs as structured JSON |
| `image_url` | text | Product image URL |
| `release_year` | integer | Year the component was released |
| `is_active` | boolean | False = hidden from public API |
| `created_at` | timestamp | When the record was created |
| `updated_at` | timestamp | When the record was last modified |

Plus the compatibility fields used by the engine: `socket`, `supported_ram_types`, `max_ram_frequency`, `ram_type`, `frequency_mhz`, `length_mm`, `max_gpu_length_mm`, `wattage`, `tdp`.

---

## Slugs

Every component has a URL-safe slug generated from its brand and name:

```
AMD + Ryzen 7 7700X  →  "amd-ryzen-7-7700x"
ASUS + ROG Strix B650E-F Gaming WiFi  →  "asus-rog-strix-b650e-f-gaming-wifi"
```

Slugs are unique. If a collision occurs (two components with the same brand+name), a numeric suffix is appended: `amd-ryzen-7-7700x-2`.

Slugs are used in the frontend URL: `/components/amd-ryzen-7-7700x`. The `GET /api/components/slug/:slug` endpoint resolves a slug to a full component object.

The slug generation logic is in `backend/src/utils/slugify.ts` and `backend/src/services/slugService.ts`.

---

## Zod validation schemas

Every component category has a Zod schema in `backend/src/schemas/componentSchemas.ts`. When an admin creates or updates a component via the API, the request body is validated against the schema for the specified category before any database query runs.

Example — CPU schema:
```typescript
const cpuSchema = baseSchema.extend({
  socket: z.string().min(1),
  tdp: z.number().int().positive().optional(),
});
```

If validation fails, the API returns HTTP 400 with the exact field names that failed:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation échouée",
    "fields": ["socket"]
  }
}
```

The `category` field is required and must be one of the 8 valid categories. The middleware uses `Object.hasOwn()` to check this — not `in` — to prevent prototype pollution attacks.

---

## Searching and filtering

`GET /api/components` supports several query parameters:

| Parameter | Type | Description |
|---|---|---|
| `category` | string | Filter by category (e.g. `?category=gpu`) |
| `socket` | string | Filter by socket (e.g. `?socket=AM5`) |
| `ram_type` | string | Filter by RAM type (e.g. `?ram_type=DDR5`) |
| `brand` | string | Filter by brand (e.g. `?brand=AMD`) |
| `search` | string | Full-text search across name, brand, and slug |
| `page` | integer | Page number (default: 1) |
| `limit` | integer | Items per page (default: 20, max: 100) |

Results are ordered by `name ASC` by default. The response includes an `X-Total-Count` header with the total number of matching components (for pagination).

The search filter uses `LIKE` with proper wildcard escaping — user input containing `%` or `_` is escaped before being passed to the query, so these characters are treated as literals rather than SQL wildcards.

Inactive components (`is_active = false`) are never returned by the public API. They're only visible in the admin panel.

---

## Smart search

`GET /api/components/smart-search` is used by the `ComponentPicker` in the configurator. It extends the regular search with:

- Compatibility filtering: when a build is provided, only returns components compatible with the current selection (e.g. only AM5 motherboards when an AM5 CPU is selected)
- Price data: includes the lowest available price for each component
- Stock status: indicates whether the component is available from any retailer

This endpoint powers the searchable dropdown in the configurator — users see compatible components with prices without leaving the build page.

---

## The catalog

The catalog was seeded with 305+ real-world components covering the Moroccan market:

- 20 CPUs: AMD Ryzen 5/7/9 AM5, Intel Core i5/i7/i9 LGA1700
- 18 Motherboards: B650, X670, B760, Z790
- 25 GPUs: RX 6600–7900 XTX, RTX 3060–4090
- 20 RAM kits: DDR4 and DDR5 from Corsair, G.Skill, Kingston
- 20 Storage: NVMe SSDs and SATA SSDs
- 18 PSUs: 550W–1000W from Corsair, be quiet!, Seasonic
- 15 Cases: ATX and mATX from NZXT, Fractal, Lian Li
- 14 Coolers: Air coolers and AIOs from Noctua, be quiet!, Corsair

All entries include correct specs JSONB, slug, brand, and release_year.

---

## Bulk import

Admins can import components in bulk via the admin panel's BulkImport page. It accepts CSV or JSON files, previews the first 10 rows with validation status, handles duplicate slug conflicts, and shows a results summary (imported/skipped/failed counts).

The import runs row-by-row with per-row error handling. If a row fails validation, it is counted as failed and the import continues with the next row. Successfully imported rows are committed immediately — there is no rollback on partial failure. The response always shows the exact counts: imported / skipped (slug collision) / failed.
