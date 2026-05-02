# Scraping System

The scraping system automatically collects prices from Moroccan retailer websites and stores them in the database. It runs on a schedule, handles errors gracefully, and uses a DNA-based matching algorithm to link scraped products to catalog components.

---

## Overview

```
Bun.cron() → Scheduler
  → reads scraping_interval_hours per retailer from DB
  → skips inactive retailers
  → runs each scraper
  → passes results to Aggregator
      → resolves scraper_mappings
      → extracts variant labels
      → UPSERTs prices
      → records price history if price changed
      → saves unmatched products for admin review
  → logs session summary
```

The scraper runs independently of the API server. It does not block HTTP requests and does not share state with the route handlers.

---

## The three scrapers

All three scrapers are in `apps/backend/scraper/scrapers/`. They extend `BaseScraper` which handles the HTTP fetch and HTML parsing boilerplate.

### UltraPC (`ultrapcScraper.ts`)

Scrapes [ultrapc.ma](https://ultrapc.ma) — a PrestaShop-based store. Fetches category pages and extracts product cards. After scraping, it performs a real-time stock check via the PrestaShop AJAX endpoint for mapped products only (not all 2164 scraped products — that would be too slow).

### NextLevel (`nextlevelScraper.ts`)

Scrapes [nextlevelpc.ma](https://nextlevelpc.ma). Uses category-based pagination — fetches each category URL and follows "next page" links until all products are collected.

### SetupGame (`setupgameScraper.ts`)

Scrapes [setupgame.ma](https://setupgame.ma). Single-pass scraper that fetches the product listing pages.

### BaseScraper

The abstract base class handles:
- HTTP fetch via `undici`
- HTML parsing via `cheerio`
- Retry logic: up to 3 attempts with exponential backoff (2s, 4s, 8s) on network timeout or HTTP error
- Each retry is logged at WARNING level

```typescript
abstract class BaseScraper {
  async scrape(url: string): Promise<ScrapedPrice[]> {
    // fetch → parse → extractPrices()
  }
  protected abstract extractPrices($: CheerioAPI): ScrapedPrice[];
}
```

---

## The ScrapedPrice type

Every scraper returns an array of `ScrapedPrice` objects:

```typescript
interface ScrapedPrice {
  retailer_id:  number;   // FK → retailers.id
  price:        number;   // price in MAD
  in_stock:     boolean;
  product_url:  string;   // direct link to the product page
  name:         string;   // scraped product title (used for DNA matching)
}
```

The `name` field is the raw scraped product title — it's used by the DNA matcher to find the corresponding catalog component.

---

## The auto-mapping and catalog building pipeline

After every scrape session, three steps run automatically:

### Step 1 — autoMap()
Runs the DNA matcher against all pending `unmatched_listings`. For each listing where a confident match is found (score = 1.0, or 0.8 for case/cooling), it creates a `scraper_mapping` entry so the next scrape prices it correctly.

### Step 2 — buildFromUnmatched()
For listings that still couldn't be matched, extracts structured specs from the product name and creates a new catalog entry. Supported categories:
- **CPU** — socket inferred from model family (AM4/AM5/LGA1700/LGA1851)
- **GPU** — length_mm and TDP estimated from model tier, VRAM from name
- **RAM** — DDR type, frequency, capacity extracted from name
- **Storage** — capacity and interface type extracted from name
- **Motherboard** — socket and RAM type inferred from chipset
- **PSU** — wattage extracted from name (requires explicit wattage + efficiency keyword)
- **Cooling** — AIO size extracted from name; air coolers matched by brand/model keywords
- **Case** — form factor inferred from name (ATX/mATX/ITX)

### Step 3 — autoMap() pass 2
Runs the DNA matcher again to link listings to the newly created entries.

### Quality checks
Run `bun scripts/tools/db_health_check.ts` for a full database integrity check.

---

## How the aggregator processes scraped prices

### Aggregator step 1 — UltraPC stock check

For UltraPC only: before processing, the aggregator checks real-time stock status via the PrestaShop AJAX endpoint for all mapped products. This is done in bulk to avoid checking all 2164 scraped products.

### Aggregator step 2 — Resolve mappings

For each scraped product URL, the aggregator queries `scraper_mappings` to find the corresponding `component_id`. If no mapping exists, the product goes into `unmatched_listings`.

### Aggregator step 3 — Group by (component, retailer)

Multiple scraped products can map to the same component at the same retailer (different AIB variants of the same GPU, for example). The aggregator groups them and picks the best one: cheapest in-stock offer, or cheapest out-of-stock if all variants are out of stock.

### Aggregator step 4 — Extract variant

For each product, `variantExtractor.ts` extracts a human-readable label and structured details from the scraped product name:

| Category | Example label | Details |
|---|---|---|
| GPU | "Sapphire Pulse" | `{ aib_partner: "Sapphire", model_tier: "Pulse" }` |
| CPU | "Tray" | `{ packaging: "Tray", has_igpu: false }` |
| RAM | "2x16GB XMP CL30" | `{ kit_config: "2x16GB", memory_profile: "XMP", cas_latency: 30 }` |
| Storage | "Gen4" | `{ pcie_gen: "Gen4", form_factor: "M.2 2280" }` |
| PSU | "Fully modular ATX 3.0" | `{ modularity: "Fully modular", atx_version: "ATX 3.0" }` |

### Aggregator step 5 — UPSERT price

The aggregator UPSERTs into the `prices` table using `(component_id, retailer_id, product_url)` as the conflict key. If the row exists, it updates price, stock, variant label, and last_updated.

### Aggregator step 6 — Record price history

If the price changed since the last scrape, a new row is inserted into `price_history`. This table only grows — it never updates. It's the source of data for the price history chart.

### Aggregator step 7 — Handle unmatched

Products with no mapping in `scraper_mappings` are inserted into `unmatched_listings` (skipped if already there). Admins can review these in the admin panel and either link them to a component or dismiss them.

---

## The DNA matcher

The DNA matcher (`apps/backend/src/utils/componentMatcher.ts`) is used by the auto-mapping scripts to automatically link scraped products to catalog components.

### Why not simple string matching?

Generic fuzzy matching fails for PC hardware because model numbers are critical. "RTX 4070" and "RTX 4080" share 90% of their characters — a fuzzy matcher would consider them similar. But they're completely different products with a 500 MAD price difference.

### How DNA matching works

Instead of comparing full strings, the matcher extracts "DNA tokens" — the minimal set of identifiers that uniquely describe a component within its category.

**GPU DNA:** chipset model + suffix
```
"Gigabyte GeForce RTX 4090 Gaming OC 24G"  →  ["rtx4090"]
"MSI GeForce RTX 4070 Ti SUPER Gaming X"   →  ["rtx4070tisuper"]
```

**CPU DNA:** family + model number
```
"AMD Ryzen 5 7600X"   →  ["ryzen5", "7600x"]
"Intel Core i7-13700K" →  ["i7", "13700k"]
```

**RAM DNA:** capacity + type + speed
```
"Corsair Vengeance 2x16GB DDR5 6000MHz"  →  ["32gb", "ddr5", "6000"]
```

**Motherboard DNA:** chipset + socket
```
"ASUS ROG Strix B650E-F Gaming WiFi"  →  ["b650e", "am5"]
```

### Space-tolerant regex

Each DNA token is converted to a regex that tolerates optional spaces at letter/digit boundaries:

```
"rtx4090"     →  /\brtx\s*4090\b/i     matches "RTX 4090" and "RTX4090"
"rx7900xtx"   →  /\brx\s*7900\s*xtx\b/i  matches "RX 7900 XTX" but NOT "RX 7900 XT"
"ryzen5"      →  /\bryzen\s*5\b/i       matches "Ryzen 5" and "Ryzen5"
```

The `\b` word boundaries prevent substring matches — "rx7900xt" will not match "rx7900xtx".

### Bundle detection

Pre-built PCs appear in retailer listings and would match multiple components simultaneously. The matcher detects this: if a product name matches 2+ major component categories (cpu, gpu, motherboard), it's rejected as a bundle.

### Confidence threshold

A match is only accepted when **all** DNA tokens are found in the product name (score = 1.0). Partial matches are rejected to avoid false positives. It's better to leave a product unmatched than to link it to the wrong component.

---

## The scheduler

`apps/backend/scraper/scheduler.ts` uses `Bun.cron()` to run the scraping session on a schedule.

The schedule is read from the database — each retailer has a `scraping_interval_hours` column. This means different retailers can be scraped at different frequencies without redeploying the server.

Inactive retailers (`is_active = false`) are skipped entirely.

---

## Operational scripts

Several scripts in `apps/backend/scripts/tools/` support the scraping workflow:

| Script | What it does |
|---|---|
| `db_health_check.ts` | Full database integrity check |
| `run_all_scrapes.ts` | Manually trigger all scrapers and aggregate results |
| `run_catalog_builder.ts` | Run the catalog builder on unmatched listings |
| `backfill_slugs.ts` | Backfill slugs for components missing them |
| `check_mbs.ts` | Check motherboard data integrity |
| `import_benchmarks.ts` | Import benchmark scores from JSON |

The golden dataset (`apps/backend/src/__tests__/fixtures/golden_dataset.json`) contains 50 manually verified (product name → component) pairs used to measure matcher accuracy.

---

## Error handling

Each scraper runs inside a `try/catch` in the scheduler. If one scraper fails (network error, site structure changed, etc.), the error is logged to the `scraper_logs` table and the next scraper continues. One broken site never stops the full session.

The `scraper_logs` table stores structured log entries with level (INFO/WARNING/ERROR), site name, and message. Admins can view these in the admin panel's log viewer.
