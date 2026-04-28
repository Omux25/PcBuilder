# Scripts

One-off and operational scripts. Run with `bun <script>` from the `backend/` directory.

These are not part of the production server — they're tools for data management, debugging, and maintenance.

---

## Scraping & mapping

| Script | What it does |
|---|---|
| `run_all_scrapes.ts` | Run all 3 scrapers and aggregate results into the database |
| `remap_all.ts` | Re-run DNA matching across all unmatched listings for all retailers |
| `auto_map_ultrapc.ts` | Auto-map UltraPC unmatched listings using the DNA matcher |
| `auto_map_nextlevel.ts` | Auto-map NextLevel unmatched listings |
| `auto_map_setupgame.ts` | Auto-map SetupGame unmatched listings |
| `shadow_run_matcher.ts` | Dry-run the DNA matcher → outputs CSV for manual review (no DB writes) |
| `evaluate_matcher.ts` | Precision/recall evaluation against the golden dataset — exits 1 on false positive |
| `time_scrapers.ts` | Benchmark each scraper and category for performance tuning |

**Recommended workflow for new mappings:**
1. Run `shadow_run_matcher.ts` → review the CSV
2. If results look good, run `remap_all.ts` to apply

---

## Database maintenance

| Script | What it does |
|---|---|
| `backfill_slugs.ts` | Generate slugs for components that have none (run after migration 006) |
| `deactivate_unused_retailers.ts` | Set `is_active = false` for placeholder retailers |
| `check_retailers_db.ts` | Inspect retailer rows and active status |
| `add_missing_components.sql` | Catalog gap-fill for components found in unmatched listings |
| `add_missing_cpus.sql` | Add missing CPU entries to the catalog |
| `add_nextlevel_retailer.sql` | Insert NextLevel retailer row |
| `add_setupgame_retailer.sql` | Insert SetupGame retailer row |
| `add_ultrapc_retailer.sql` | Insert UltraPC retailer row |

---

## Analysis & diagnostics

| Script | What it does |
|---|---|
| `analyze_prices.sql` | Diagnostic queries for price table health |
| `analyze_unmatched.sql` | Analyze unmatched listings by retailer and category |
| `analyze_missing_gpus.sql` | Find GPUs in unmatched listings not in the catalog |
| `check_prices.sql` | Spot-check price data quality |
| `missing_models.sql` | Find model numbers in unmatched listings with no catalog match |

---

## Inspection (NextLevel)

Scripts used during NextLevel scraper development to understand the site structure:

`find_nextlevel_categories.ts`, `inspect_nextlevel.ts` → `v4.ts`, `test_nextlevel.ts`

These are kept for reference but not needed in normal operation.
