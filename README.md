# PC Builder Maroc

A price comparator and compatibility checker for PC components in Morocco. Users pick parts, get instant compatibility feedback, and compare prices across Moroccan retailers. The platform does **not** sell anything — it redirects users to retailer websites to complete purchases.

**Team:** Salmane ELHJOUJI (backend) · Ghali KHARMOUDY (frontend)
**School:** EMSI Orangers, Casablanca · **Deadline:** May 11, 2026
**Status:** Complete — 608 tests passing

---

## What it does

- **Compatibility checker** — select CPU, motherboard, GPU, RAM, storage, PSU, case, and cooling. Get instant errors (socket mismatch, RAM type mismatch, GPU too long) and warnings (RAM speed exceeded, PSU underpowered).
- **Price comparison** — see all available offers for a component across UltraPC, NextLevel, and SetupGame, sorted by availability and price. Includes variant labels (AIB partner, CPU packaging, RAM kit config).
- **Price history** — track how prices have changed over time with a line chart per retailer.
- **Admin panel** — manage the component catalog, monitor scrapers, review unmatched listings, and view dashboard stats.

---

## Stack

| Layer | Technology |
|---|---|
| Runtime | Bun 1.3+ (in WSL2) |
| Backend | Hono (TypeScript) |
| Database | PostgreSQL 16 + Bun.sql |
| Scraping | undici + cheerio |
| Frontend | React 19 + Vite |
| Admin panel | React 19 + Vite (separate app) |
| Auth | JWT + bcrypt + refresh tokens |
| Testing | bun test + fast-check (608 tests) |

---

## Project structure

```
PcBuilder/
├── apps/
│   ├── backend/      ← Bun + Hono API server + scraping system
│   ├── frontend/     ← React + Vite (user-facing, port 5173)
│   └── admin/        ← React + Vite (admin panel, port 5174)
├── notes/            ← Project documentation
│   ├── features/     ← How each feature works
│   └── reference/    ← API, database, dev setup, stack
├── dev.ps1           ← One-command dev stack launcher
└── docker-compose.yml
```

---

## Quick start

```powershell
# 1. Start PostgreSQL (once per WSL2 session)
wsl -d Ubuntu -- bash -c "sudo service postgresql start"

# 2. Start backend + frontend + admin panel
.\dev.ps1
```

- Backend API → http://localhost:3000
- Frontend → http://localhost:5173
- Admin panel → http://localhost:5174/admin

For first-time setup (migrations, seed data, dependencies), see [notes/reference/dev-setup.md](notes/reference/dev-setup.md).

---

## Documentation

| File | What it covers |
|---|---|
| [notes/features/compatibility-engine.md](notes/features/compatibility-engine.md) | The 7 compatibility rules explained |
| [notes/features/price-comparison.md](notes/features/price-comparison.md) | Price offers, variant model, price history |
| [notes/features/scraping-system.md](notes/features/scraping-system.md) | Scrapers, DNA matcher, aggregator, scheduler |
| [notes/features/authentication.md](notes/features/authentication.md) | JWT, refresh tokens, rate limiting |
| [notes/features/component-catalog.md](notes/features/component-catalog.md) | Categories, schemas, slugs, search |
| [notes/features/admin-panel.md](notes/features/admin-panel.md) | Dashboard, CRUD, bulk import, unmatched listings |
| [notes/reference/api.md](notes/reference/api.md) | Full API route reference |
| [notes/reference/database.md](notes/reference/database.md) | All 12 database tables |
| [notes/reference/dev-setup.md](notes/reference/dev-setup.md) | How to run everything locally |
| [notes/reference/stack.md](notes/reference/stack.md) | Technology choices and why |

---

## Running tests

```powershell
wsl -d Ubuntu -- bash -c "cd /mnt/c/Headquarters/Projects/PcBuilder/apps/backend && ~/.bun/bin/bun test 2>&1"
```

Expected: 608 pass, 0 fail across 42 files.

---

## Environment variables

Copy `apps/backend/.env.example` to `apps/backend/.env` and fill in your values.

| Variable | Description |
|---|---|
| `PORT` | HTTP server port (default: 3000) |
| `PGHOST` | PostgreSQL host |
| `PGPORT` | PostgreSQL port (5433 in this environment) |
| `PGDATABASE` | Database name |
| `PGUSER` | Database user |
| `PGPASSWORD` | Database password |
| `JWT_SECRET` | Secret for signing access tokens |
| `JWT_EXPIRES_IN` | Access token expiry (default: 15m) |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins |
| `NODE_ENV` | production or development |
| `SERVE_STATIC` | Set to true in production to serve frontend from backend |
