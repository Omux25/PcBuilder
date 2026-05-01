# Database Guide

> **Full reference:** See [`notes/reference/database.md`](../reference/database.md) for the complete table-by-table schema reference.

This guide explains the database design decisions and how to work with the schema day-to-day.

---

## Schema overview

19 migrations, 13 tables. All migrations are in `backend/src/db/migrations/` numbered 001–019.

Run all migrations:
```powershell
wsl -d Ubuntu -- bash -c "cd /mnt/c/Headquarters/Projects/PcBuilder/backend && ~/.bun/bin/bun src/db/migrate.ts"
```

---

## Component categories and their columns

The `components` table is polymorphic — all 8 categories share one table. Category-specific columns are `NULL` when they don't apply.

| Category | Required columns | Optional columns |
|---|---|---|
| `cpu` | `socket` | `tdp` |
| `motherboard` | `socket`, `supported_ram_types`, `max_ram_frequency` | `tdp`, `form_factor` |
| `gpu` | `length_mm` | `tdp` |
| `ram` | `ram_type`, `frequency_mhz` | `tdp` |
| `storage` | — | `tdp` |
| `psu` | `wattage` | — |
| `case` | `max_gpu_length_mm` | `supported_motherboards`, `max_cooler_height_mm` |
| `cooling` | — | `tdp`, `height_mm` |

All categories also have: `name` (required), `brand`, `slug`, `description`, `specs` (JSONB), `image_url`, `release_year`, `is_active`.

---

## Adding a new table or column

1. Create a new migration file: `backend/src/db/migrations/0XX_description.sql`
2. Number it sequentially — check the current highest number first
3. Use `IF NOT EXISTS` / `IF NOT EXISTS` guards so migrations are idempotent
4. Update the TypeScript interface in the relevant service file
5. Update `notes/reference/database.md` — add the new table/column to the reference
6. Update `notes/diagrams/class.puml` if the ERD changes

---

## Key design decisions

**Why one table for all component categories?**
Simpler queries — no JOINs needed to get a component with all its fields. The `specs` JSONB column handles category-specific data that doesn't need to be queried directly.

**Why flat columns for compatibility fields?**
The compatibility engine needs to compare `cpu.socket` with `motherboard.socket` directly. Storing these in JSONB would require extracting them in every query. Flat columns are faster and type-safe.

**Why `NUMERIC(10,2)` for prices?**
Floating-point types (`FLOAT`, `DOUBLE`) cannot represent decimal values exactly. `0.1 + 0.2 = 0.30000000000000004` in floating point. `NUMERIC` stores exact decimal values — critical for prices.

**Why `ON DELETE CASCADE` on foreign keys?**
Deleting a component automatically removes its prices, mappings, and history. This prevents orphaned rows and simplifies the delete logic in the service layer.
