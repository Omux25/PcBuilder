> Set up the backend folder structure, installed all dependencies, and created the five SQL migration files that define the database schema.

**Track:** Backend · **Dev:** Salmane · **Status:** ✅ Done · **Files:** `package.json`, `tsconfig.json`, `.env.example`, `backend/src/db/migrations/001–005`

---

## What was built

### Folder structure

The backend lives entirely inside `backend/`. Source code goes in `backend/src/`, the scraper in `backend/scraper/`, and SQL migration scripts in `backend/src/db/migrations/`.

### `package.json` — dependencies

```json
{
  "name": "pc-builder-backend",
  "module": "src/server.ts",
  "type": "module",
  "dependencies": {
    "hono": "4.4.2",
    "zod": "3.23.8",
    "jsonwebtoken": "9.0.2",
    "bcrypt": "5.1.1",
    "cheerio": "1.0.0",
    "undici": "6.19.2"
  },
  "devDependencies": {
    "fast-check": "3.20.0",
    "@types/jsonwebtoken": "9.0.6",
    "@types/bcrypt": "5.0.2"
  }
}
```

`"type": "module"` enables ESM (`import`/`export`). Bun handles TypeScript natively — no `ts-node` or build step needed. `fast-check` is the property-based testing library (optional tests).

### `tsconfig.json` — TypeScript configuration

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "types": ["node"]
  },
  "include": ["src/**/*", "scraper/**/*"],
  "exclude": ["node_modules", "src/**/__tests__/**", "src/__tests__/**"]
}
```

Test directories are excluded from the main TypeScript program because they import from `bun:test`, which is only available inside WSL2 — not on Windows where VS Code runs. The tests still run fine in WSL2.

### The 5 SQL migrations

Migrations are SQL scripts that create database tables. They are numbered so they always run in the same order.

#### Migration 001 — `components`

The most important table. Stores all 7 component categories in a single **polymorphic table** — category-specific columns are `NULL` when they don't apply.

```sql
CREATE TABLE IF NOT EXISTS components (
    id                   SERIAL PRIMARY KEY,
    name                 VARCHAR(255) NOT NULL,
    brand                VARCHAR(100),
    category             VARCHAR(50) NOT NULL
                             CHECK (category IN (
                                 'cpu', 'motherboard', 'gpu', 'ram',
                                 'storage', 'psu', 'case'
                             )),
    socket               VARCHAR(50),
    supported_ram_types  VARCHAR(20)[],
    max_ram_frequency    INTEGER,
    ram_type             VARCHAR(10),
    frequency_mhz        INTEGER,
    length_mm            INTEGER,
    max_gpu_length_mm    INTEGER,
    wattage              INTEGER,
    tdp                  INTEGER,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Which columns apply to which category:

| Column | cpu | motherboard | gpu | ram | storage | psu | case |
|---|---|---|---|---|---|---|---|
| `socket` | ✅ | ✅ | | | | | |
| `supported_ram_types` | | ✅ | | | | | |
| `max_ram_frequency` | | ✅ | | | | | |
| `ram_type` | | | | ✅ | | | |
| `frequency_mhz` | | | | ✅ | | | |
| `length_mm` | | | ✅ | | | | |
| `max_gpu_length_mm` | | | | | | | ✅ |
| `wattage` | | | | | | ✅ | |
| `tdp` | ✅ | ✅ | ✅ | ✅ | ✅ | | |

Two indexes are created: one on `category` (for filtering by type) and one partial index on `socket` (only for rows where socket is not null — CPUs and Motherboards).

#### Migration 002 — `retailers`

Stores Moroccan e-commerce sites. `UNIQUE` on `name` prevents duplicates.

#### Migration 003 — `prices`

One row per (component, retailer) pair. The `UNIQUE (component_id, retailer_id)` constraint is the target of the scraper's UPSERT — when the scraper runs again, it updates the existing row instead of inserting a duplicate.

`ON DELETE CASCADE` on both foreign keys means: if a component or retailer is deleted, all related price rows are deleted automatically.

#### Migration 004 — `scraper_logs`

Stores logs from the scraping system. Three severity levels:

| Level | When |
|---|---|
| `INFO` | Normal operation (session started, session complete) |
| `WARNING` | Something unusual but not critical |
| `ERROR` | A scraper failed for a specific site |

#### Migration 005 — `admins`

Stores admin accounts. `password_hash` stores the bcrypt hash — never the plain-text password.

---

## Why it matters

Without this task, nothing else can be built. The folder structure defines where every future file goes. The migrations define the database schema that all services and routes depend on. The `package.json` pins exact dependency versions so the project builds identically on any machine.

---

## Files involved

```
backend/
├── package.json                              ← created
├── tsconfig.json                             ← created
├── .env.example                              ← created
└── src/
    └── db/
        └── migrations/
            ├── 001_create_components.sql     ← created
            ├── 002_create_retailers.sql      ← created
            ├── 003_create_prices.sql         ← created
            ├── 004_create_scraper_logs.sql   ← created
            └── 005_create_admins.sql         ← created
```
