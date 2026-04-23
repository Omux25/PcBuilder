# Database

The PostgreSQL schema, how to run migrations, and how the tables relate.

## What is a migration?

A migration is a SQL script that creates or modifies database tables. Instead of manually creating tables in a GUI tool, you write numbered SQL files that can be run on any machine to produce the exact same database.

Migration files live in `backend/src/db/migrations/`. They are numbered and must be run in order.

## How to run migrations

```bash
# In WSL2, from the project root
psql -U pc_builder_user -d pc_builder -f backend/src/db/migrations/001_create_components.sql
psql -U pc_builder_user -d pc_builder -f backend/src/db/migrations/002_create_retailers.sql
psql -U pc_builder_user -d pc_builder -f backend/src/db/migrations/003_create_prices.sql
psql -U pc_builder_user -d pc_builder -f backend/src/db/migrations/004_create_scraper_logs.sql
psql -U pc_builder_user -d pc_builder -f backend/src/db/migrations/005_create_admins.sql
```

Each script uses `CREATE TABLE IF NOT EXISTS` — safe to run multiple times.

---

## Table 1: `components`

The most important table. Stores all 7 component categories in a single **polymorphic table**.

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

### Which columns apply to which category

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

Category-specific columns are `NULL` when they don't apply. The Zod schemas at the application layer enforce which fields are required per category before any data reaches the database.

### Indexes

```sql
CREATE INDEX IF NOT EXISTS idx_components_category ON components (category);
CREATE INDEX IF NOT EXISTS idx_components_socket ON components (socket) WHERE socket IS NOT NULL;
```

The second index is a **partial index** — it only covers rows where `socket` is not null (CPUs and Motherboards), saving space.

---

## Table 2: `retailers`

```sql
CREATE TABLE IF NOT EXISTS retailers (
    id       SERIAL PRIMARY KEY,
    name     VARCHAR(100) NOT NULL UNIQUE,
    base_url VARCHAR(255) NOT NULL,
    active   BOOLEAN NOT NULL DEFAULT TRUE
);
```

Stores Moroccan e-commerce sites. `UNIQUE` on `name` prevents duplicates.

---

## Table 3: `prices`

```sql
CREATE TABLE IF NOT EXISTS prices (
    id           SERIAL PRIMARY KEY,
    component_id INTEGER NOT NULL REFERENCES components(id) ON DELETE CASCADE,
    retailer_id  INTEGER NOT NULL REFERENCES retailers(id) ON DELETE CASCADE,
    price        NUMERIC(10, 2) NOT NULL,
    in_stock     BOOLEAN NOT NULL DEFAULT FALSE,
    product_url  VARCHAR(500) NOT NULL,
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (component_id, retailer_id)
);
```

One row per (component, retailer) pair. The `UNIQUE (component_id, retailer_id)` constraint is the target of the scraper's UPSERT:

```sql
INSERT INTO prices (component_id, retailer_id, price, in_stock, product_url, last_updated)
VALUES ($1, $2, $3, $4, $5, NOW())
ON CONFLICT (component_id, retailer_id)
DO UPDATE SET
  price        = EXCLUDED.price,
  in_stock     = EXCLUDED.in_stock,
  product_url  = EXCLUDED.product_url,
  last_updated = NOW();
```

`ON DELETE CASCADE` on both foreign keys means: if a component or retailer is deleted, all related price rows are deleted automatically.

---

## Table 4: `scraper_logs`

```sql
CREATE TABLE IF NOT EXISTS scraper_logs (
    id         SERIAL PRIMARY KEY,
    level      VARCHAR(10) NOT NULL CHECK (level IN ('INFO', 'WARNING', 'ERROR')),
    site       VARCHAR(100),
    message    TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Log levels

| Level | When |
|---|---|
| `INFO` | Normal operation — session started, session complete with summary |
| `WARNING` | Something unusual but not critical — e.g. HTML structure changed |
| `ERROR` | A scraper failed for a specific site |

---

## Table 5: `admins`

```sql
CREATE TABLE IF NOT EXISTS admins (
    id            SERIAL PRIMARY KEY,
    username      VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

`password_hash` stores the bcrypt hash — never the plain-text password.

---

## Entity relationships

```
components ──< prices >── retailers
```

- One component can have many price offers (one per retailer)
- One retailer can have many price offers (one per component)
- `prices` is the join table between `components` and `retailers`

See [../diagrams/database.puml](../diagrams/database.puml) for the full ERD.
