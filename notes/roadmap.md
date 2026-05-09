# PC Builder Maroc — Roadmap & Technical Debt

> This file tracks what was built, known limitations, and future ambitions.
> Update this file whenever a significant decision is made or a known issue is identified.

---

## Current Status (May 9, 2026)

The platform is functional and presentation-ready. All 666 backend tests and 43 frontend tests pass.

**What works:**
- Price scraping from 3 Moroccan retailers (UltraPC, NextLevel PC, SetupGame)
- UltraPC scraper: HTML card parsing with full name extraction from img alt text (fixes truncated titles)
- Compatibility checking (8 rules: socket, RAM type, RAM frequency, GPU length, PSU wattage, form factor, cooler height, RAM slots)
- Component catalog: 954 GPUs, 647 cases, 597 motherboards, 559 storage, 451 RAM, 346 cooling, 274 PSU, 140 CPUs, 67 fans, 53 thermal paste
- Admin panel: dashboard, component CRUD, bulk import, unmatched listings queue, preset management, real-time scraper logs
- Frontend: configurator, category browse, component detail, price comparison, presets, market trends, price history (7j/30j/1an)
- Image extraction: UltraPC + NextLevel upgraded to large_default (800px)
- Stock status: per-retailer display with staleness warning, accurate OOS detection with 50% threshold guard
- Price history: daily aggregation, 7j/30j/1an period toggle, re-fetches without page reload
- Automatic data quality pass after every scrape (deduplication, name cleaning, category fixes)
- Backend audit fixes: OOS threshold guard, transaction wrap for mappings+prices, GPU DNA token-based matching
- Junk dismiss: spec-text artifacts (32 Cœurs, Direct Die frames) dismissed before pipeline
- scrape_and_validate.ts: autonomous scrape + data quality check script (4/4 checks pass)
- 6185 prices across all retailers, 135 unmatched listings (acceptable)

---

## Pending — Post-Presentation

### Peripheral Categories (deferred)
UltraPC and other retailers sell peripherals (mice, keyboards, monitors, headsets, etc.) that `inferCategory()` correctly identifies but the DB `components_category_check` constraint rejects. These currently go to `unmatched_listings` silently.

**Decision needed:** Add peripheral categories to the DB schema and catalog, or keep the platform focused on PC build components only.

If adding peripherals:
- Add migration to expand `components_category_check` constraint
- Add peripheral categories to `ComponentCategory` type
- Add display/filtering support in frontend
- Decide on compatibility rules (peripherals don't have build compatibility constraints)

---

## Known Technical Debt

### 🔴 Critical — Pipeline Architecture

**Problem: Image assignment is split across 3 phases instead of 1**

The scraping pipeline has a fundamental design flaw:
1. The **aggregator** backfills images for already-mapped components (Phase 5.5)
2. The **catalog builder** assigns images from `unmatched_listings.image_url` for new components
3. A **post-session image gap fill** catches anything missed by phases 1 and 2

This means a component that DNA-matches an existing entry (skips `unmatched_listings`) but whose retailer URL wasn't in the aggregator's `imageUpdates` map ends up with no image after the first scrape. A second scrape is needed to fill the gap.

**Root cause:** The aggregator collects images into `imageUpdates` only for `finalResolved` items (matched products). New components created in the same session via bulk insert don't get their images assigned until the gap fill runs.

**Proper fix (deferred to post-deadline rework):**
- Unify all 3 phases into a single pipeline pass
- Every component — whether matched, DNA-matched, or newly created — gets its best available image assigned in the same loop
- No separate backfill step needed
- See "Future Architecture" section below

---

### 🟡 Medium — Scraper Coverage

**NextLevel PC rate limiting**
- NextLevel returns 503 errors when scraped too aggressively
- Current mitigation: 200ms between pages, 500ms between categories
- This makes NextLevel the slowest scraper (~3 min for full scrape)
- Better fix: implement exponential backoff with jitter, or scrape NextLevel on a separate slower schedule

**No image proxy / caching**
- All component images are direct retailer URLs
- If a retailer changes their CDN or removes a product, the image breaks
- Fix: proxy images through our own CDN (Cloudflare R2 or similar), cache on first fetch

**Only 3 retailers**
- Morocco has more PC retailers: Matelpro, Tradeline, Electro Bazar
- These are in the DB as inactive — scrapers not yet implemented
- Each would require a new scraper class following the existing pattern

---

### 🟡 Medium — Data Quality

**RAM names include frequency (intentional but inconsistent)**
- RAM names like "Vengeance 32GB DDR5 6000MHz" keep the frequency because it's the product identifier
- But CL specs (CL36, CL40) are stripped — this is inconsistent
- Decision needed: either keep all specs or strip all specs from RAM names

**Component deduplication is reactive, not preventive**
- Duplicates are merged after they're created
- Better: check for duplicates before inserting in the catalog builder
- The DNA matcher already does this for existing components, but not for components being created in the same batch

**No spec data for most components**
- Socket, TDP, RAM type etc. are only populated for components where the scraper name contains enough info
- Most components have NULL for these fields, so compatibility checking only works for a subset
- Fix: integrate a product database API (PCPartPicker API, or manual data entry in admin panel)

---

### 🟢 Low — Frontend

**No image fallback in the UI**
- When `image_url` is null or the URL is broken, the component shows a generic icon
- Better: show a category-specific placeholder image (e.g. a CPU silhouette for CPUs)

**Spec display in Configurator is sparse**
- Currently shows TDP, frequency, wattage, form factor
- Could show more relevant specs per category (e.g. socket for CPUs, RAM type for motherboards)

**No mobile optimization**
- The configurator grid collapses to single column on mobile but isn't fully optimized
- Category browse and component detail pages need mobile review

---

## Future Architecture (Post-Deadline Rework)

### Unified Scraping Pipeline

Replace the current 3-phase approach with a single unified pipeline:

```
scrape() → [ScrapedProduct]
    ↓
classify() → matched | new | unmatched
    ↓ (all in one pass)
for each product:
  - assign to component (existing or newly created)
  - assign best image immediately
  - clean name immediately
  - record price
    ↓
quality_check() → merge dupes, fix categories
    ↓
done — no second pass needed
```

Key change: the `imageByUrl` map is built once at the start and consulted for every component assignment, whether the component is existing or newly created.

### Image Pipeline

1. Scrape → collect `{ product_url, image_url }` pairs
2. For each component assignment, look up image by product_url
3. Score image quality (MPK penalty, placeholder rejection)
4. Assign best image immediately — no deferred backfill
5. On subsequent scrapes, only update image if new score > current score

### Additional Retailers

Each new retailer needs:
1. A scraper class in `apps/backend/scraper/scrapers/`
2. Registration in `apps/backend/scraper/config/retailers.config.ts`
3. A seed entry in `apps/backend/seed/01_retailers.sql`
4. Tests in `apps/backend/scraper/scrapers/__tests__/`

Priority order: Matelpro → Electro Bazar → Tradeline

### Spec Data Enrichment

Options (in order of effort):
1. **Manual admin entry** — add spec fields to the admin component edit form
2. **PCPartPicker scraping** — scrape specs from PCPartPicker by matching component names (legal gray area)
3. **Manufacturer API** — use AMD/Intel/NVIDIA product APIs where available
4. **Community database** — integrate with Open Hardware Monitor or similar

---

## Phase History

### Phase 1 — Core Backend (completed)
- Database schema (12 tables)
- Component catalog with 25 categories
- Compatibility engine (7 rules)
- JWT authentication
- Admin CRUD routes

### Phase 2 — Scraping System (completed)
- UltraPC scraper (PrestaShop JSON API)
- NextLevel PC scraper (HTML + Cheerio)
- SetupGame scraper (WooCommerce JSON API)
- Aggregator with DNA matching
- Catalog builder (auto-creates components from unmatched listings)
- Scheduler (Bun.cron)

### Phase 3 — Frontend (completed)
- Configurator (PCPartPicker-style, multi-slot RAM/storage)
- Category browse with filters
- Component detail with price history
- Price comparison
- Presets
- Market trends
- Theme toggle (dark/light)

### Phase 4 — Data Quality & Images (completed)
- Image extraction from all 3 scrapers
- Image quality scoring (MPK/bundle penalty)
- Automatic deduplication after each scrape
- Name cleaning (GHz/MHz removal, Intel normalization)
- Category correction (RAM miscategorized as storage/PSU)
- Post-session data quality pass integrated into pipeline

---

## Ambitions Beyond Deadline

- **Price alerts** — notify users when a component drops below a target price
- **Build sharing** — shareable URLs for builds (already partially implemented via URL encoding)
- **Affiliate links** — earn commission on retailer redirects
- **Mobile app** — React Native wrapper around the existing API
- **More retailers** — expand to Tunisia (Mytek, Wiki, Tunisianet) and other Moroccan retailers
- **Benchmark integration** — show real-world performance data alongside prices
- **AI build recommendations** — suggest compatible builds based on budget and use case
