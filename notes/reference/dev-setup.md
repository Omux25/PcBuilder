# Dev Setup

How to run the full stack locally. The quickest path is `dev.ps1` — it starts all three processes in one command.

---

## Prerequisites

- Windows 11 with WSL2 (Ubuntu distro installed)
- Bun installed in WSL2 at `~/.bun/bin/bun`
- PostgreSQL installed in WSL2: `sudo apt install postgresql`
- VS Code with the Remote - WSL extension

---

## Quick start

```powershell
# 1. Start PostgreSQL (once per WSL2 session)
wsl -d Ubuntu -- bash -c "echo '2525' | sudo -S service postgresql start"

# 2. Start all three dev servers at once
.\dev.ps1
```

`dev.ps1` opens three separate terminal windows:
- Backend (Bun/Hono) → http://localhost:3000
- Frontend (Vite) → http://localhost:5173
- Admin panel (Vite) → http://localhost:5174/admin

---

## First-time setup

### 1. Start PostgreSQL

```powershell
wsl -d Ubuntu -- bash -c "echo '2525' | sudo -S service postgresql start"
```

PostgreSQL runs on port **5433** in this environment (not the default 5432).

### 2. Check the .env file

`apps/backend/.env` should already exist. It contains:

```env
PORT=3000
PGHOST=127.0.0.1
PGPORT=5433
PGDATABASE=pc_builder
PGUSER=pc_builder_user
PGPASSWORD=pc_builder_pass_2024
JWT_SECRET=dev-secret-change-in-production
JWT_EXPIRES_IN=15m
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5174
```

Bun loads `.env` automatically — no extra steps needed.

### 3. Run all migrations

```powershell
wsl -d Ubuntu -- bash -c "cd /mnt/c/Headquarters/Projects/PcBuilder/apps/backend && ~/.bun/bin/bun src/db/migrate.ts"
```

Or run them manually in order (001–019) if you prefer:

```powershell
$base = "/mnt/c/Headquarters/Projects/PcBuilder/apps/backend/src/db/migrations"
$migrations = @(
  "001_create_components.sql", "002_create_retailers.sql", "003_create_prices.sql",
  "004_create_scraper_logs.sql", "005_create_admins.sql", "006_expand_components.sql",
  "007_expand_retailers.sql", "008_create_scraper_mappings.sql", "009_create_price_history.sql",
  "010_create_preset_builds.sql", "011_create_unmatched_listings.sql",
  "012_create_admin_activity_log.sql", "013_create_refresh_tokens.sql",
  "014_prices_variant_model.sql", "015_add_benchmark_score.sql",
  "016_fix_ram_types_encoding.sql", "017_add_trigram_index.sql",
  "018_hash_refresh_tokens.sql", "019_add_compatibility_columns.sql"
)
foreach ($m in $migrations) {
  wsl -d Ubuntu -- bash -c "echo '2525' | sudo -S -u postgres psql -d pc_builder -f $base/$m"
}
```

### 4. Seed the database

```powershell
$db = "echo '2525' | sudo -S -u postgres psql -d pc_builder"
# Retailers + admin account
wsl -d Ubuntu -- bash -c "$db -f /mnt/c/Headquarters/Projects/PcBuilder/apps/backend/seed/01_retailers.sql"
# Component catalog
wsl -d Ubuntu -- bash -c "$db -f /mnt/c/Headquarters/Projects/PcBuilder/apps/backend/seed/02_catalog.sql"
# Preset builds
wsl -d Ubuntu -- bash -c "$db -f /mnt/c/Headquarters/Projects/PcBuilder/apps/backend/seed/03_presets.sql"
```

Admin credentials: `admin` / `admin123`

### 5. Install dependencies

```powershell
# Backend
wsl -d Ubuntu -- bash -c "cd /mnt/c/Headquarters/Projects/PcBuilder/apps/backend && ~/.bun/bin/bun install"
# Frontend
wsl -d Ubuntu -- bash -c "cd /mnt/c/Headquarters/Projects/PcBuilder/apps/frontend && ~/.bun/bin/bun install"
# Admin panel
wsl -d Ubuntu -- bash -c "cd /mnt/c/Headquarters/Projects/PcBuilder/apps/admin && ~/.bun/bin/bun install"
```

---

## Running individual services

If you don't want to use `dev.ps1`:

```powershell
# Backend (hot reload)
wsl -d Ubuntu -- bash -c "cd /mnt/c/Headquarters/Projects/PcBuilder/apps/backend && ~/.bun/bin/bun --hot src/server.ts"

# Frontend
wsl -d Ubuntu -- bash -c "cd /mnt/c/Headquarters/Projects/PcBuilder/apps/frontend && ~/.bun/bin/bun run dev"

# Admin panel
wsl -d Ubuntu -- bash -c "cd /mnt/c/Headquarters/Projects/PcBuilder/apps/admin && ~/.bun/bin/bun run dev"
```

---

## Running tests

```powershell
wsl -d Ubuntu -- bash -c "cd /mnt/c/Headquarters/Projects/PcBuilder/apps/backend && ~/.bun/bin/bun test 2>&1"
```

Expected: **578 pass, 0 fail** across 41 files.

Test categories:
- Unit tests — compatibility engine, middleware, services, routes, DNA matcher
- Integration tests — edge cases (404, 401, validation), scraping cycle
- Property-based tests (fast-check) — correctness properties

---

## Running scripts

One-off scripts in `apps/backend/scripts/tools/` are run directly with Bun:

```powershell
# Run all scrapers manually
wsl -d Ubuntu -- bash -c "cd /mnt/c/Headquarters/Projects/PcBuilder/apps/backend && ~/.bun/bin/bun scripts/tools/run_all_scrapes.ts"

# Run catalog builder on pending unmatched listings
wsl -d Ubuntu -- bash -c "cd /mnt/c/Headquarters/Projects/PcBuilder/apps/backend && ~/.bun/bin/bun scripts/tools/run_catalog_builder.ts"

# Full database health check
wsl -d Ubuntu -- bash -c "cd /mnt/c/Headquarters/Projects/PcBuilder/apps/backend && ~/.bun/bin/bun scripts/tools/db_health_check.ts"

# Backfill slugs for components missing them
wsl -d Ubuntu -- bash -c "cd /mnt/c/Headquarters/Projects/PcBuilder/apps/backend && ~/.bun/bin/bun scripts/tools/backfill_slugs.ts"

# Import benchmark scores from JSON
wsl -d Ubuntu -- bash -c "cd /mnt/c/Headquarters/Projects/PcBuilder/apps/backend && ~/.bun/bin/bun scripts/tools/import_benchmarks.ts"
```

---

## Why test files show errors in VS Code

Test files import from `bun:test` which is only available inside Bun (WSL2). VS Code's TypeScript server runs on Windows where Bun isn't installed. Test directories are excluded from `tsconfig.json` to prevent red squiggles — the tests still run perfectly in WSL2.

---

## Regenerating UML diagrams

```bash
# From the project root (requires Java + plantuml.jar at project root)
java -jar plantuml.jar -tpng notes/diagrams/*.puml -o rendered
```

The rendered PNGs go into `notes/diagrams/rendered/` (gitignored — regeneratable).
