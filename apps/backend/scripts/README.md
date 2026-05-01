# Operational Scripts & Tools

This directory contains utility scripts for database management, price scraping, and catalog maintenance.

## Tools (`scripts/tools/`)

### `run_all_scrapes.ts`
Triggers a full price scraping session for all active retailers.
```bash
bun scripts/tools/run_all_scrapes.ts
```

### `run_catalog_builder.ts`
Processes unmatched listings and attempts to auto-create new catalog entries for recognized products.
```bash
bun scripts/tools/run_catalog_builder.ts
```

### `db_health_check.ts`
Runs a comprehensive suite of data integrity checks (orphaned records, invalid JSON, missing slugs, etc.).
```bash
bun scripts/tools/db_health_check.ts
```

### `backfill_slugs.ts`
Generates missing slugs for components that don't have them.
```bash
bun scripts/tools/backfill_slugs.ts
```

## SQL Scripts (`scripts/sql/`)
Contains raw SQL snippets for manual data fixes and reporting.
