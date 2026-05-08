# Component Catalog

The component catalog is the database of PC parts that users can select when building a PC. It covers 8 categories, supports rich metadata, and is searchable with pagination.

---

## Categories
The catalog supports a comprehensive range of hardware, grouped into **Core** and **Extras** (peripherals, networking, accessories).

| Category | Description | Key fields |
|---|---|---|
| `cpu` | Processors | socket, tdp, cores/threads |
| `motherboard` | Motherboards | socket, supported_ram_types, slots |
| `gpu` | Graphics Cards | length_mm, tdp, vram_gb |
| `ram` | Memory Kits | ram_type, frequency_mhz, capacity |
| `storage` | SSD/HDD | type (NVMe/SATA), capacity |
| `psu` | Power Supplies | wattage, efficiency_rating |
| `case` | PC Cases | clearances, form_factors |
| `cooling` | CPU Coolers | height_mm, tdp |
| `peripherals` | Monitor, Keyboard, Mouse, Audio, Webcam | — |
| `networking` | Wired/Wireless Adapters, Sound Cards | — |
| `accessories` | Fans, Thermal Paste, UPS, Controllers | — |

---

## Component fields

Every component has these base fields:

| Field | Type | Description |
|---|---|---|
| `id` | integer | Auto-incrementing primary key |
| `name` | text | Product name (e.g. "Ryzen 7 7700X") |
| `brand` | text | Manufacturer (e.g. "AMD") |
| `category` | text | One of the categories above |
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

Slugs are used in the frontend URL: `/components/amd-ryzen-7-7700x`.

---

## Zod validation schemas

Every component category has a Zod schema in `apps/backend/src/schemas/componentSchemas.ts`. Request bodies are validated against these schemas before any database query runs.


---

## Searching and Selection

The platform uses a two-stage selection workflow:

1.  **Main Configurator**: Shows the selected parts in a high-density table.
2.  **Full-Page Browse**: When a user clicks "Choisir", they are taken to a dedicated browse page (`/browse/:category`) which features:
    -   **Professional Table**: Image, Name, Specs, and Price in a scan-friendly layout.
    -   **Sidebar Filters**: Persistent filtering by brand, socket, price, and stock.
    -   **Smart Search**: Real-time compatibility checks (via `GET /api/components/smart-search`) that flag incompatible parts based on the current build.

This workflow eliminates the clutter of inline menus and provides users with a focused environment for comparing hardware specifications.

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

---

## Preset builds

Preset builds are curated PC configurations created by admins. They give users a starting point — a complete, compatible build they can adopt as-is or use as inspiration.

### Data model

A preset is stored in two tables:

- `preset_builds` — the preset itself (name, description, use_case, total_price_estimate)
- `preset_build_components` — one row per (preset, category) linking to a component

Each preset has at most one component per category. The `use_case` field is one of: `gaming`, `workstation`, `office`, `budget`.

### The `incomplete` flag

When a preset is fetched, the service checks whether any of its linked components have `is_active = false`. If so, `incomplete: true` is set on the response. The preset is still returned — the frontend can warn the user that one or more parts are no longer available.

### Public API

- `GET /api/builds/presets` — list all active presets, optionally filtered by `use_case`
- `GET /api/builds/presets/:id` — single preset by ID

Both endpoints return the full component map keyed by category:

```json
{
  "id": 1,
  "name": "Budget Gaming Build",
  "use_case": "gaming",
  "incomplete": false,
  "components": {
    "cpu": { "id": 10, "slug": "amd-ryzen-5-7600x", "name": "Ryzen 5 7600X", ... },
    "gpu": { "id": 42, "slug": "nvidia-rtx-4070", "name": "RTX 4070", ... }
  }
}
```

### Admin management

Admins create and manage presets via `GET/POST/PUT/DELETE /api/admin/presets`. Creating or updating a preset replaces all component links in a transaction — no partial state is possible if the server crashes mid-update.
