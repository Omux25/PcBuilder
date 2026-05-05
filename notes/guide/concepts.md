# Core Concepts Guide

> **Detailed feature docs:** See [`notes/features/`](../features/) for in-depth explanations of each feature.

This guide explains the key concepts and domain terms used throughout the codebase.

---

## Compatibility rules

The compatibility engine (`apps/backend/src/services/compatibilityService.ts`) validates a PC build against 7 rules. Rules only fire when both required components are present.

| Rule | Type | Components | Condition |
|---|---|---|---|
| `socket_mismatch` | Error | CPU + Motherboard | `cpu.socket !== motherboard.socket` |
| `ram_type_mismatch` | Error | RAM + Motherboard | `ram.ram_type` not in `motherboard.supported_ram_types` |
| `ram_frequency_exceeded` | Warning | RAM + Motherboard | `ram.frequency_mhz > motherboard.max_ram_frequency` |
| `gpu_too_long` | Error | GPU + Case | `gpu.length_mm > case.max_gpu_length_mm` |
| `form_factor_mismatch` | Error | Motherboard + Case | `motherboard.form_factor` not in `case.supported_motherboards` |
| `cooler_too_tall` | Error | Cooling + Case | `cooling.height_mm > case.max_cooler_height_mm` |
| `psu_underpowered` | Warning | PSU | `psu.wattage < ceil(total_tdp × 1.5)` |

The first 6 rules are declarative entries in the `RULES` array. `psu_underpowered` is a calculated check that runs after the TDP sum — it's treated as a rule from the user's perspective but implemented separately.

TDP is always calculated (not a rule): `total_tdp = sum of all component TDPs`, `recommended_psu_wattage = ceil(total_tdp × 1.5)`.

**Errors** = build physically cannot work. **Warnings** = build works but not optimally.

The `compatible` field is `true` only when `errors` is empty. Warnings don't affect compatibility.

---

## DNA matching

The DNA matcher (`apps/backend/src/utils/componentMatcher.ts`) links scraped product names to catalog components.

Instead of fuzzy string matching, it extracts "DNA tokens" — the minimal identifiers that uniquely describe a component within its category:

- **GPU:** `["rtx4090"]` — chipset model + suffix
- **CPU:** `["ryzen5", "7600x"]` — family + model number
- **RAM:** `["32gb", "ddr5", "6000"]` — capacity + type + speed
- **Motherboard:** `["b650e", "am5"]` — chipset + socket

A match requires ALL DNA tokens to appear in the product name (score = 1.0). This prevents "RTX 4070" from matching "RTX 4080".

---

## Variant model

The `prices` table stores one row per `(component_id, retailer_id, product_url)` — not one per component/retailer pair. This handles the case where the same component appears multiple times at the same retailer (different AIB partners, packaging, etc.).

Each price row has:
- `variant_label` — human-readable label (e.g. "Sapphire Pulse", "Tray", "2x16GB CL30")
- `variant_details` — structured JSONB with category-specific metadata

---

## Slug

A URL-safe identifier derived from brand + name:
```
AMD + Ryzen 7 7700X  →  "amd-ryzen-7-7700x"
```

Slugs are unique. Collisions get a numeric suffix: `amd-ryzen-7-7700x-2`.

Used in frontend URLs: `/components/amd-ryzen-7-7700x`.

---

## Scraper registry

`apps/backend/scraper/config/retailers.config.ts` is the single source of truth for scraper-to-retailer mapping. Each entry maps a retailer's `base_url` to its scraper implementation. The actual database ID is resolved at runtime — never hardcoded.

```typescript
export const RETAILER_SCRAPERS: RetailerScraperConfig[] = [
  {
    baseUrl: 'https://www.ultrapc.ma',
    name: 'UltraPC',
    run: (retailer_id: number) => new UltraPcScraper().scrapeAllCategories(retailer_id),
  },
  {
    baseUrl: 'https://nextlevelpc.ma',
    name: 'NextLevel PC',
    run: (retailer_id: number) => new NextLevelScraper().scrapeAllCategories(retailer_id),
  },
  {
    baseUrl: 'https://setupgame.ma',
    name: 'SetupGame',
    run: (retailer_id: number) => new SetupGameScraper().scrapeAllCategories(retailer_id),
  },
];
```

At session start, `session.ts` queries `SELECT id, base_url FROM retailers WHERE is_active = true` and builds a `baseUrl → id` map. Each scraper config entry is matched by normalizing both URLs to their origin (stripping paths and trailing slashes), so `https://setupgame.ma/` and `https://setupgame.ma/components` both match `https://setupgame.ma`.

The `retailer_id` is passed into `scrapeAllCategories(id)` at runtime — scrapers never hardcode their own ID. This means the system works correctly on any machine regardless of what IDs the database assigned.

**To add a new retailer:**
1. Add a row to the `retailers` table via the admin panel
2. Create a scraper class in `scraper/scrapers/`
3. Add one entry to `RETAILER_SCRAPERS` with the retailer's `base_url`
4. No changes to `session.ts` needed

---

## TDP (Thermal Design Power)

The maximum heat a component generates under full load, measured in watts. Used to calculate the recommended PSU wattage:

```
recommended_psu_wattage = ceil(total_tdp × 1.5)
```

The 1.5× multiplier provides a 50% headroom — PSUs degrade over time and power draw spikes during load.
